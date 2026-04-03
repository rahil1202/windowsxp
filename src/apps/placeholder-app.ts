import type { AppHostContext, AppInstance } from "../types";
import { renderXpMock, type XpMockConfig } from "./xp-ui-kit";

export function createPlaceholderModule(config: XpMockConfig): {
  mount(host: HTMLElement, _ctx: AppHostContext): AppInstance;
} {
  return {
    mount(host) {
      host.innerHTML = renderXpMock(config);

      return {
        unmount() {
          host.innerHTML = "";
        }
      };
    }
  };
}
