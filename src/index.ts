import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VERSION = "0.1.0";

export default function xpiCaveman(pi: ExtensionAPI): void {
  pi.registerCommand("xpi-caveman", {
    description: "Show xpi-caveman status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`xpi-caveman ${VERSION} loaded`);
    },
  });
}
