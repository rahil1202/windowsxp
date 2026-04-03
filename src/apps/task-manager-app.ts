import type { AppHostContext, AppInstance } from "../types";
import { createXpGameShell } from "./xp-game-shell";

interface ProcessInfo {
  name: string;
  pid: number;
  cpu: number;
  memory: number;
  status: "Running" | "Not Responding";
}

function generateProcesses(): ProcessInfo[] {
  const processes: ProcessInfo[] = [
    { name: "System", pid: 4, cpu: 2, memory: 8192, status: "Running" },
    { name: "explorer.exe", pid: 1234, cpu: 5, memory: 45670, status: "Running" },
    { name: "svchost.exe", pid: 512, cpu: 1, memory: 23450, status: "Running" },
    { name: "rundll32.exe", pid: 1456, cpu: 0, memory: 12340, status: "Running" },
    { name: "spoolsv.exe", pid: 2345, cpu: 0, memory: 8900, status: "Running" },
    { name: "services.exe", pid: 340, cpu: 0, memory: 15670, status: "Running" },
    { name: "lsass.exe", pid: 456, cpu: 0, memory: 9870, status: "Running" },
    { name: "Winlogon.exe", pid: 567, cpu: 0, memory: 7650, status: "Running" },
    { name: "smss.exe", pid: 600, cpu: 0, memory: 567, status: "Running" },
    { name: "csrss.exe", pid: 678, cpu: 1, memory: 18970, status: "Running" },
    { name: "winmm.dll", pid: 789, cpu: 0, memory: 4560, status: "Running" },
    { name: "ntdll.dll", pid: 890, cpu: 0, memory: 3450, status: "Running" }
  ];
  
  // Simulate some random variations in CPU/Memory
  return processes.map(p => ({
    ...p,
    cpu: Math.max(0, p.cpu + (Math.random() - 0.5) * 3),
    memory: Math.max(1000, p.memory + (Math.random() - 0.5) * 5000)
  }));
}

function formatBytes(bytes: number): string {
  const kb = Math.round(bytes / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export function mount(host: HTMLElement, ctx: AppHostContext): AppInstance {
  const abortController = new AbortController();
  let updateInterval: number | null = null;

  const shell = createXpGameShell(host, {
    className: "task-manager-app",
    menuButtons: [
      { label: "File", onClick: () => {} },
      { label: "Options", onClick: () => {} },
      { label: "View", onClick: () => {} },
      { label: "Help", onClick: () => {} }
    ],
    toolbarButtons: [
      { label: "New Task", onClick: () => showNewTaskDialog() },
      { label: "End Task", onClick: () => endSelectedTask() },
      { label: "Shut Down", onClick: () => {} }
    ],
    statusLeft: "Processes: 12",
    statusRight: "CPU: 9% | Memory: 143 MB"
  });

  host.dataset.appClass = "task-manager-app";
  shell.body.innerHTML = `
    <div class="task-manager-app__root">
      <div class="task-manager-app__tabs">
        <button class="task-manager-app__tab is-active" data-tab="processes">Processes</button>
        <button class="task-manager-app__tab" data-tab="performance">Performance</button>
        <button class="task-manager-app__tab" data-tab="networking">Networking</button>
        <button class="task-manager-app__tab" data-tab="users">Users</button>
      </div>
      <div class="task-manager-app__content">
        <div class="task-manager-app__processes-tab is-visible">
          <div class="task-manager-app__list-header">
            <div class="task-manager-app__col-name">Image Name</div>
            <div class="task-manager-app__col-pid">PID</div>
            <div class="task-manager-app__col-cpu">CPU Usage</div>
            <div class="task-manager-app__col-mem">Memory</div>
            <div class="task-manager-app__col-status">Status</div>
          </div>
          <div class="task-manager-app__processes-list" data-processes-list></div>
        </div>
        <div class="task-manager-app__performance-tab">
          <div class="task-manager-app__perf-section">
            <h3>CPU Usage</h3>
            <div class="task-manager-app__perf-chart" data-cpu-chart></div>
            <p class="task-manager-app__perf-stat">Usage: <strong data-cpu-usage>9</strong>%</p>
            <p class="task-manager-app__perf-stat">Processes: <strong>12</strong></p>
          </div>
          <div class="task-manager-app__perf-section">
            <h3>Memory Usage</h3>
            <div class="task-manager-app__perf-chart" data-mem-chart></div>
            <p class="task-manager-app__perf-stat">Total: <strong data-mem-total>512 MB</strong></p>
            <p class="task-manager-app__perf-stat">Available: <strong data-mem-avail>369 MB</strong></p>
          </div>
        </div>
        <div class="task-manager-app__networking-tab">
          <p style="padding: 12px; color: #666;">Network adapter statistics not available</p>
        </div>
        <div class="task-manager-app__users-tab">
          <p style="padding: 12px; color: #666;">Currently logged in as: <strong>User</strong></p>
        </div>
      </div>
    </div>
  `;

  const processList = shell.body.querySelector<HTMLElement>("[data-processes-list]");
  const tabButtons = shell.body.querySelectorAll<HTMLButtonElement>(".task-manager-app__tab");
  const tabContents = shell.body.querySelectorAll<HTMLElement>("[class*='__tab']");

  if (!processList) {
    throw new Error("Task Manager failed to mount");
  }

  let selectedProcessId: number | null = null;

  function renderProcesses(): void {
    const processes = generateProcesses();
    if (!processList) return;
    processList.innerHTML = "";

    processes.forEach((proc) => {
      const row = document.createElement("div");
      row.className = "task-manager-app__process-row";
      if (proc.pid === selectedProcessId) {
        row.classList.add("is-selected");
      }
      row.dataset.pid = String(proc.pid);
      row.innerHTML = `
        <div class="task-manager-app__col-name">${proc.name}</div>
        <div class="task-manager-app__col-pid">${proc.pid}</div>
        <div class="task-manager-app__col-cpu">${proc.cpu.toFixed(1)}%</div>
        <div class="task-manager-app__col-mem">${formatBytes(proc.memory)}</div>
        <div class="task-manager-app__col-status" style="color: ${proc.status === "Running" ? "#008000" : "#ff0000"}">
          ${proc.status}
        </div>
      `;

      row.addEventListener("click", () => {
        selectedProcessId = selectedProcessId === proc.pid ? null : proc.pid;
        renderProcesses();
      });

      processList!.appendChild(row);
    });

    updateStats();
  }

  function updateStats(): void {
    const processes = generateProcesses();
    const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);
    const cpuUsage = Math.round(processes.reduce((sum, p) => sum + p.cpu, 0));
    
    const memTotal = shell.body.querySelector<HTMLElement>("[data-mem-total]");
    const memAvail = shell.body.querySelector<HTMLElement>("[data-mem-avail]");
    const cpuUsageStat = shell.body.querySelector<HTMLElement>("[data-cpu-usage]");

    if (memTotal) memTotal.textContent = formatBytes(totalMemory);
    if (memAvail) memAvail.textContent = formatBytes(512 * 1024 * 1024 - totalMemory);
    if (cpuUsageStat) cpuUsageStat.textContent = String(cpuUsage);

    shell.setStatus(`Processes: ${processes.length}`, `CPU: ${cpuUsage}% | Memory: ${formatBytes(totalMemory)}`);
  }

  function showNewTaskDialog(): void {
    alert("Enter new task to run:\n\n(This is a simulated Task Manager)");
  }

  function endSelectedTask(): void {
    if (selectedProcessId) {
      alert(`Task "${selectedProcessId}" has been ended.`);
      selectedProcessId = null;
      renderProcesses();
    } else {
      alert("Please select a process first.");
    }
  }

  // Tab switching
  tabButtons.forEach((btn: HTMLButtonElement) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b: HTMLButtonElement) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const tabName = btn.dataset.tab;
      tabContents.forEach((tab: HTMLElement) => {
        if (tab.classList.contains(`task-manager-app__${tabName}-tab`)) {
          tab.classList.add("is-visible");
        } else if (tab.className.includes("__tab")) {
          tab.classList.remove("is-visible");
        }
      });
    });
  });

  renderProcesses();
  updateInterval = window.setInterval(() => {
    renderProcesses();
  }, 2000);

  return {
    unmount() {
      abortController.abort();
      if (updateInterval !== null) {
        window.clearInterval(updateInterval);
      }
      shell.destroy();
    },
    onFocus() {
      ctx.requestFocus();
    }
  };
}
