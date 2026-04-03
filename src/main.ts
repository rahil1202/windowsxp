import "./style.css";

import {
  loginProfileAvatarUrls,
  loginUserAvatarUrl,
  restartIconUrl,
  shutdownIconUrl,
  windowsXpLogoUrl,
  windowsXpStartupSoundUrl
} from "./assets";
import { WindowsXpShell } from "./shell";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root element not found");
}

root.innerHTML = `
  <main id="experience" class="experience">
    <a href="#shell-view" class="skip-link">Skip to desktop</a>
    <section id="shell-view" class="shell-view" aria-hidden="true"></section>

    <section id="boot-screen" class="boot-screen is-visible" aria-live="polite">
      <div class="boot-screen__brand">
        <img id="boot-logo" class="boot-screen__logo" src="${windowsXpLogoUrl}" alt="" width="180" height="180" />
        <div class="boot-screen__wordmark">
          <p>Microsoft<span>&reg;</span></p>
          <h1>Windows<span>xp</span></h1>
          <strong>Professional</strong>
        </div>
      </div>

      <div class="boot-screen__progress" aria-hidden="true">
        <div class="boot-screen__progress-track">
          <div class="boot-screen__progress-glow"></div>
        </div>
      </div>
    </section>

    <section id="login-screen" class="login-screen" aria-label="Windows XP login">
      <div class="login-screen__header"></div>
      <div class="login-screen__center">
        <div class="login-screen__panel">
          <div class="login-screen__account login-screen__account--system" aria-hidden="true">
            <span class="login-screen__avatar-wrap login-screen__avatar-wrap--system">
              <img class="login-screen__avatar" src="${windowsXpLogoUrl}" alt="" width="96" height="96" />
            </span>
            <span class="login-screen__name">Windows XP</span>
          </div>
          <div class="login-screen__divider"></div>
          <button id="login-profile" type="button" class="login-screen__account login-screen__account--user">
            <span class="login-screen__avatar-wrap">
              <img id="login-avatar" class="login-screen__avatar" src="${loginUserAvatarUrl}" alt="" width="120" height="96" />
            </span>
            <span class="login-screen__name">User</span>
          </button>
        </div>
        <p class="login-screen__hint">To begin, click your user name</p>
      </div>
      <div class="login-screen__footer">
        <button id="login-power" type="button" class="login-screen__power">
          <span class="login-screen__power-icon" style="background-image:url('${shutdownIconUrl}')"></span>
          <span>Turn off computer</span>
        </button>
        <span class="login-screen__footer-copy">
          <span>After you log on, you can add or change accounts.</span>
          <span>Just go to Control Panel and click User Accounts.</span>
        </span>
      </div>
    </section>

    <section id="power-screen" class="power-screen" aria-hidden="true">
      <div class="power-screen__panel">
        <img id="power-screen-icon" src="${windowsXpLogoUrl}" alt="" width="96" height="96" />
        <h2 id="power-screen-title">Windows XP is shut down.</h2>
        <p id="power-screen-copy">Press start to turn on your computer.</p>
      </div>
      <button id="power-on-button" type="button" class="power-screen__start-button">
        <img src="${windowsXpLogoUrl}" alt="" width="40" height="40" />
        <span>Start Up</span>
      </button>
    </section>
  </main>
`;

const bootScreen = document.querySelector<HTMLElement>("#boot-screen");
const loginScreen = document.querySelector<HTMLElement>("#login-screen");
const shellView = document.querySelector<HTMLElement>("#shell-view");
const powerScreen = document.querySelector<HTMLElement>("#power-screen");
const loginProfile = document.querySelector<HTMLButtonElement>("#login-profile");
const loginPower = document.querySelector<HTMLButtonElement>("#login-power");
const powerOnButton = document.querySelector<HTMLButtonElement>("#power-on-button");
const powerScreenIcon = document.querySelector<HTMLImageElement>("#power-screen-icon");
const loginAvatar = document.querySelector<HTMLImageElement>("#login-avatar");
const bootProgressGlow = document.querySelector<HTMLElement>(".boot-screen__progress-glow");
const powerScreenTitle = document.querySelector<HTMLElement>("#power-screen-title");
const powerScreenCopy = document.querySelector<HTMLElement>("#power-screen-copy");

if (
  !bootScreen ||
  !loginScreen ||
  !shellView ||
  !powerScreen ||
  !loginProfile ||
  !loginPower ||
  !powerOnButton ||
  !powerScreenIcon ||
  !powerScreenTitle ||
  !powerScreenCopy
) {
  throw new Error("XP experience shell failed to mount");
}

const bootScreenElement = bootScreen;
const loginScreenElement = loginScreen;
const shellViewElement = shellView;
const powerScreenElement = powerScreen;
const loginProfileButton = loginProfile;
const loginPowerButton = loginPower;
const powerOnButtonElement = powerOnButton;
const powerScreenIconElement = powerScreenIcon;
const powerScreenTitleElement = powerScreenTitle;
const powerScreenCopyElement = powerScreenCopy;

if (loginAvatar) {
  const randomAvatar =
    loginProfileAvatarUrls[Math.floor(Math.random() * loginProfileAvatarUrls.length)] ??
    loginUserAvatarUrl;
  loginAvatar.src = randomAvatar;
}

const startupSound = new Audio(windowsXpStartupSoundUrl);
startupSound.preload = "none";

let shell: WindowsXpShell | null = null;

function hideShellView(): void {
  shellViewElement.classList.remove("is-visible");
  shellViewElement.setAttribute("aria-hidden", "true");
  shellViewElement.style.display = "none";
}

function showShellView(): void {
  shellViewElement.style.display = "";
  shellViewElement.classList.add("is-visible");
  shellViewElement.setAttribute("aria-hidden", "false");
}

function destroyShell(): void {
  shell?.destroy();
  shell = null;
}

function showBoot(): void {
  destroyShell();
  if (bootProgressGlow) {
    const speeds = [0.92, 1.1, 1.34, 1.58];
    const speed = speeds[Math.floor(Math.random() * speeds.length)] ?? 1.1;
    bootProgressGlow.style.animationDuration = `${speed}s`;
  }
  hideShellView();
  powerScreenElement.classList.remove("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "true");
  loginScreenElement.classList.remove("is-visible", "is-entering");
  bootScreenElement.classList.add("is-visible");
}

function showLogin(): void {
  destroyShell();
  hideShellView();
  powerScreenElement.classList.remove("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "true");
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.add("is-visible");
}

function setPowerScreenMessage(title: string, copy: string): void {
  powerScreenTitleElement.textContent = title;
  powerScreenCopyElement.textContent = copy;
}

function setPowerScreenIcon(src: string): void {
  powerScreenIconElement.src = src;
}

function showPoweredOff(): void {
  destroyShell();
  hideShellView();
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.remove("is-visible", "is-entering");
  setPowerScreenIcon(shutdownIconUrl);
  setPowerScreenMessage("Windows XP is shut down.", "Press start to turn on your computer.");
  powerScreenElement.classList.add("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "false");
  powerOnButtonElement.hidden = false;
}

async function showShutdownTransition(): Promise<void> {
  destroyShell();
  hideShellView();
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.remove("is-visible", "is-entering");
  setPowerScreenIcon(shutdownIconUrl);
  setPowerScreenMessage("Windows is shutting down...", "Saving your settings.");
  powerScreenElement.classList.add("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "false");
  powerOnButtonElement.hidden = true;
  await new Promise((resolve) => window.setTimeout(resolve, 1300));
  setPowerScreenIcon(shutdownIconUrl);
  setPowerScreenMessage("Windows XP is shut down.", "Press Start Up to turn on your computer.");
  powerOnButtonElement.hidden = false;
}

async function showRestartTransition(): Promise<void> {
  destroyShell();
  hideShellView();
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.remove("is-visible", "is-entering");
  setPowerScreenIcon(restartIconUrl);
  setPowerScreenMessage("Windows is restarting...", "Please wait.");
  powerScreenElement.classList.add("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "false");
  powerOnButtonElement.hidden = true;
  await new Promise((resolve) => window.setTimeout(resolve, 1100));
  await restartSystem();
}

async function showSleepTransition(): Promise<void> {
  destroyShell();
  hideShellView();
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.remove("is-visible", "is-entering");
  setPowerScreenMessage("Windows XP is entering standby.", "Waking up returns you to the Welcome screen.");
  powerScreenElement.classList.add("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "false");
  await new Promise((resolve) => window.setTimeout(resolve, 1200));
  powerScreenElement.classList.remove("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "true");
  showLogin();
}

async function restartSystem(): Promise<void> {
  destroyShell();
  hideShellView();
  loginScreenElement.classList.remove("is-visible", "is-entering");
  powerScreenElement.classList.remove("is-visible");
  powerScreenElement.setAttribute("aria-hidden", "true");
  bootScreenElement.classList.remove("is-exiting");
  bootScreenElement.classList.add("is-visible");
  await runBootSequence();
}

function mountDesktopShell(): void {
  destroyShell();
  shell = new WindowsXpShell(shellViewElement, {
    onLogOff() {
      showLogin();
    },
    onRestart() {
      void showRestartTransition();
    },
    onPowerOff() {
      void showShutdownTransition();
    },
    onSleep() {
      void showSleepTransition();
    }
  });
}

async function enterDesktop(): Promise<void> {
  loginProfileButton.disabled = true;
  mountDesktopShell();
  bootScreenElement.classList.remove("is-visible", "is-exiting");
  loginScreenElement.classList.add("is-entering");
  showShellView();

  try {
    startupSound.currentTime = 0;
    await startupSound.play();
  } catch {
    // Browser autoplay restrictions are acceptable here.
  }

  window.setTimeout(() => {
    loginScreenElement.classList.remove("is-visible", "is-entering");
    loginProfileButton.disabled = false;
  }, 240);
}

async function runBootSequence(): Promise<void> {
  showBoot();
  await new Promise((resolve) => window.setTimeout(resolve, 2800));
  bootScreenElement.classList.add("is-exiting");
  window.setTimeout(() => {
    bootScreenElement.classList.remove("is-visible", "is-exiting");
    loginScreenElement.classList.add("is-visible");
  }, 380);
}

loginProfileButton.addEventListener("click", () => {
  void enterDesktop();
});

loginPowerButton.addEventListener("click", () => {
  showPoweredOff();
});

powerOnButtonElement.addEventListener("click", () => {
  void restartSystem();
});

void runBootSequence();
