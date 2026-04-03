import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

type Operator = "+" | "-" | "*" | "/" | null;

interface CalculatorButton {
  label: string;
  action: string;
  wide?: boolean;
  accent?: boolean;
}

interface CalculatorState {
  display: string;
  storedValue: number | null;
  pendingOperator: Operator;
  overwrite: boolean;
  memoryValue: number | null;
}

const MEMORY_BUTTONS: CalculatorButton[] = [
  { label: "MC", action: "memory-clear" },
  { label: "MR", action: "memory-recall" },
  { label: "MS", action: "memory-store" },
  { label: "M+", action: "memory-add" },
  { label: "M-", action: "memory-subtract" }
];

const BUTTON_ROWS: CalculatorButton[][] = [
  [
    { label: "Backspace", action: "backspace" },
    { label: "CE", action: "clear-entry" },
    { label: "C", action: "clear-all" },
    { label: "±", action: "sign" }
  ],
  [
    { label: "sqrt", action: "sqrt" },
    { label: "%", action: "percent" },
    { label: "1/x", action: "reciprocal" },
    { label: "/", action: "operator" }
  ],
  [
    { label: "7", action: "digit" },
    { label: "8", action: "digit" },
    { label: "9", action: "digit" },
    { label: "*", action: "operator" }
  ],
  [
    { label: "4", action: "digit" },
    { label: "5", action: "digit" },
    { label: "6", action: "digit" },
    { label: "-", action: "operator" }
  ],
  [
    { label: "1", action: "digit" },
    { label: "2", action: "digit" },
    { label: "3", action: "digit" },
    { label: "+", action: "operator" }
  ],
  [
    { label: "0", action: "digit", wide: true },
    { label: ".", action: "decimal" },
    { label: "=", action: "equals", accent: true }
  ]
];

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  const shell = createXpGameShell(host, {
    className: "calculator-app",
    menuButtons: [
      { label: "Edit", title: "Clear", onClick: () => clearAll() },
      { label: "View", title: "Standard", onClick: () => setStatus("Standard") },
      { label: "Help", title: "Calculator", onClick: () => setStatus("Windows XP Calculator") }
    ],
    statusLeft: "Standard",
    statusRight: "Calculator"
  });

  const state: CalculatorState = {
    display: "0",
    storedValue: null,
    pendingOperator: null,
    overwrite: true,
    memoryValue: null
  };

  shell.body.innerHTML = `
    <section class="calculator-app__root">
      <div class="calculator-app__memory">
        ${MEMORY_BUTTONS.map(
          (button) => `
            <button
              type="button"
              class="calculator-app__memory-button"
              data-action="${button.action}"
              data-value="${button.label}"
            >${button.label}</button>
          `
        ).join("")}
      </div>
      <div class="calculator-app__display" data-display>0</div>
      <div class="calculator-app__keypad">
        ${BUTTON_ROWS.map(
          (row) => `
            <div class="calculator-app__row">
              ${row
                .map(
                  (button) => `
                    <button
                      type="button"
                      class="calculator-app__button${button.wide ? " is-wide" : ""}${button.accent ? " is-accent" : ""}"
                      data-action="${button.action}"
                      data-value="${button.label}"
                    >
                      ${button.label}
                    </button>
                  `
                )
                .join("")}
            </div>
          `
        ).join("")}
      </div>
    </section>
  `;

  const display = shell.body.querySelector<HTMLElement>("[data-display]");
  if (!display) {
    throw new Error("Calculator display failed to mount");
  }
  const displayElement = display;

  function setStatus(message: string): void {
    shell.setStatus(message, "Standard");
  }

  function currentValue(): number {
    return Number(state.display) || 0;
  }

  function render(): void {
    displayElement.textContent = state.display;
    shell.root.dataset.memory = state.memoryValue === null ? "off" : "on";
  }

  function clearAll(): void {
    state.display = "0";
    state.storedValue = null;
    state.pendingOperator = null;
    state.overwrite = true;
    state.memoryValue = null;
    render();
    setStatus("Ready");
  }

  function clearEntry(): void {
    state.display = "0";
    state.overwrite = true;
    render();
  }

  function appendDigit(value: string): void {
    if (state.overwrite || state.display === "0") {
      state.display = value;
      state.overwrite = false;
    } else {
      state.display += value;
    }
    render();
  }

  function appendDecimal(): void {
    if (state.overwrite) {
      state.display = "0.";
      state.overwrite = false;
    } else if (!state.display.includes(".")) {
      state.display += ".";
    }
    render();
  }

  function backspace(): void {
    if (state.overwrite) {
      return;
    }
    state.display = state.display.length <= 1 ? "0" : state.display.slice(0, -1);
    render();
  }

  function toggleSign(): void {
    if (state.display === "0") {
      return;
    }
    state.display = state.display.startsWith("-") ? state.display.slice(1) : `-${state.display}`;
    render();
  }

  function commit(operator: Operator): void {
    const value = currentValue();
    if (state.pendingOperator && state.storedValue !== null && !state.overwrite) {
      evaluate();
      state.storedValue = currentValue();
    } else {
      state.storedValue = value;
    }
    state.pendingOperator = operator;
    state.overwrite = true;
    render();
  }

  function applyUnary(transform: (value: number) => number, status: string): void {
    const next = transform(currentValue());
    if (!Number.isFinite(next)) {
      state.display = "Error";
      state.overwrite = true;
      setStatus("Cannot divide by zero");
      render();
      return;
    }
    state.display = String(Number(next.toFixed(10)));
    state.overwrite = true;
    render();
    setStatus(status);
  }

  function evaluate(): void {
    if (!state.pendingOperator || state.storedValue === null) {
      return;
    }
    const right = currentValue();
    let result = state.storedValue;
    if (state.pendingOperator === "+") {
      result += right;
    } else if (state.pendingOperator === "-") {
      result -= right;
    } else if (state.pendingOperator === "*") {
      result *= right;
    } else if (state.pendingOperator === "/") {
      result = right === 0 ? Number.NaN : result / right;
    }

    if (!Number.isFinite(result)) {
      state.display = "Error";
      state.storedValue = null;
      state.pendingOperator = null;
      state.overwrite = true;
      setStatus("Cannot divide by zero");
    } else {
      state.display = String(Number(result.toFixed(10)));
      state.storedValue = null;
      state.pendingOperator = null;
      state.overwrite = true;
      setStatus("Ready");
    }
    render();
  }

  function applyPercent(): void {
    const value = currentValue();
    const next =
      state.storedValue !== null && state.pendingOperator ? (state.storedValue * value) / 100 : value / 100;
    state.display = String(Number(next.toFixed(10)));
    render();
  }

  function handleMemory(action: string): void {
    if (action === "memory-clear") {
      state.memoryValue = null;
      setStatus("Memory cleared");
    } else if (action === "memory-recall") {
      if (state.memoryValue !== null) {
        state.display = String(Number(state.memoryValue.toFixed(10)));
        state.overwrite = true;
      }
      setStatus(state.memoryValue === null ? "No stored memory" : "Memory recalled");
    } else if (action === "memory-store") {
      state.memoryValue = currentValue();
      setStatus("Memory stored");
    } else if (action === "memory-add") {
      state.memoryValue = (state.memoryValue ?? 0) + currentValue();
      setStatus("Memory updated");
    } else if (action === "memory-subtract") {
      state.memoryValue = (state.memoryValue ?? 0) - currentValue();
      setStatus("Memory updated");
    }
    render();
  }

  function handleAction(action: string, value: string): void {
    if (state.display === "Error" && action !== "clear-all" && action !== "clear-entry") {
      clearAll();
    }

    if (action.startsWith("memory-")) {
      handleMemory(action);
    } else if (action === "digit") {
      appendDigit(value);
    } else if (action === "decimal") {
      appendDecimal();
    } else if (action === "backspace") {
      backspace();
    } else if (action === "clear-entry") {
      clearEntry();
    } else if (action === "clear-all") {
      clearAll();
    } else if (action === "sign") {
      toggleSign();
    } else if (action === "operator") {
      commit(value as Operator);
    } else if (action === "equals") {
      evaluate();
    } else if (action === "sqrt") {
      applyUnary((next) => Math.sqrt(next), "Square root");
    } else if (action === "reciprocal") {
      applyUnary((next) => 1 / next, "Reciprocal");
    } else if (action === "percent") {
      applyPercent();
    }
  }

  shell.body.addEventListener(
    "click",
    (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-action]");
      if (!button) {
        return;
      }
      handleAction(button.dataset.action ?? "", button.dataset.value ?? "");
    },
    { signal: abortController.signal }
  );

  shell.root.addEventListener(
    "keydown",
    (event) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
      } else if (event.key === ".") {
        event.preventDefault();
        appendDecimal();
      } else if (["+", "-", "*", "/"].includes(event.key)) {
        event.preventDefault();
        commit(event.key as Operator);
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        evaluate();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Escape") {
        event.preventDefault();
        clearAll();
      }
    },
    { signal: abortController.signal }
  );

  render();

  return {
    unmount() {
      abortController.abort();
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
      shell.root.focus();
    }
  };
}
