/**
 * Shared Menu System
 *
 * ⚠️ CRITICAL: Used by ALL projects! Test changes across all integrated projects.
 *
 * Interactive deployment menu with keyboard navigation
 * Used by ALL projects for deployment option selection
 *
 * @see /home/liqk1ugzoezh5okwywlr_/dev/shared/deploy-utils/README.md
 */

export type DeployOption =
  | "orphans"
  | "full"
  | "frontend"
  | "lambdas"
  | "schema"
  | "resolvers"
  | "stack"
  | "seed"
  | "remove"
  | "exit";

export interface MenuOption {
  key: string;
  label: string;
  description: string;
  option: DeployOption;
}

export interface StageOption<T extends string> {
  key: string;
  label: string;
  description: string;
  stage: T;
}

const DEFAULT_MENU_OPTIONS: MenuOption[] = [
  {
    key: "1",
    label: "Check Orphans",
    description: "Find and clean orphaned resources from failed deployments",
    option: "orphans",
  },
  {
    key: "2",
    label: "Full Deploy",
    description: "Deploy everything (infrastructure + frontend)",
    option: "full",
  },
  {
    key: "3",
    label: "Frontend Only",
    description: "Build and deploy frontend to S3/CloudFront",
    option: "frontend",
  },
  {
    key: "4",
    label: "Lambdas Only",
    description: "Compile, upload, and update Lambda functions",
    option: "lambdas",
  },
  {
    key: "5",
    label: "Schema Only",
    description: "Merge and upload GraphQL schema",
    option: "schema",
  },
  {
    key: "6",
    label: "Resolvers Only",
    description: "Compile and upload AppSync resolvers",
    option: "resolvers",
  },
  {
    key: "7",
    label: "CloudFormation Stack",
    description: "Update infrastructure (templates + stack)",
    option: "stack",
  },
  {
    key: "8",
    label: "Seed Database",
    description: "Populate database with test data",
    option: "seed",
  },
  {
    key: "9",
    label: "Remove Stack",
    description: "Delete all resources (DANGEROUS)",
    option: "remove",
  },
  {
    key: "0",
    label: "Exit",
    description: "Cancel deployment",
    option: "exit",
  },
];

/**
 * Menu System
 *
 * Interactive keyboard-navigable deployment menu
 */
export class MenuSystem {
  private menuOptions: MenuOption[];

  constructor(customOptions?: MenuOption[]) {
    this.menuOptions = customOptions || DEFAULT_MENU_OPTIONS;
  }

  /**
   * Show stage selection menu
   */
  public async showStageSelection<T extends string>(
    stageOptions: StageOption<T>[]
  ): Promise<T> {
    let selectedIndex = 0;
    let isFirstRender = true;

    const renderStageMenu = (selectedIdx: number): void => {
      if (!isFirstRender) {
        // Move back to start of menu and clear
        const lines = stageOptions.length + 3; // 3 header lines + N options
        process.stdout.write(`\x1b[${lines}A`);
        process.stdout.write("\x1b[J");
      }
      isFirstRender = false;

      console.log("=".repeat(60));
      console.log(
        "  Select Stage - Use \x1b[1m↑↓\x1b[0m to select, \x1b[1mEnter\x1b[0m to confirm"
      );
      console.log("=".repeat(60));

      for (let i = 0; i < stageOptions.length; i++) {
        const opt = stageOptions[i];
        const isSelected = i === selectedIdx;
        const prefix = isSelected ? "\x1b[36m❯\x1b[0m" : " ";
        const highlight = isSelected ? "\x1b[1m\x1b[36m" : "\x1b[90m";
        const reset = "\x1b[0m";
        console.log(
          `  ${prefix} ${highlight}${opt.label}${reset} - ${opt.description}`
        );
      }
    };

    renderStageMenu(selectedIndex);

    return new Promise((resolve) => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const handleKeypress = (key: string): void => {
        if (key === "\u001b[A" || key === "k") {
          // Up arrow or k
          selectedIndex =
            (selectedIndex - 1 + stageOptions.length) % stageOptions.length;
          renderStageMenu(selectedIndex);
        } else if (key === "\u001b[B" || key === "j") {
          // Down arrow or j
          selectedIndex = (selectedIndex + 1) % stageOptions.length;
          renderStageMenu(selectedIndex);
        } else if (key === "\r" || key === "\n" || key === " ") {
          // Enter or space
          cleanup();
          console.log("");
          resolve(stageOptions[selectedIndex].stage);
        } else if (key === "\u0003" || key === "q") {
          // Ctrl+C or q
          cleanup();
          console.log("\nDeployment cancelled.");
          process.exit(0);
        } else if (key >= "0" && key <= "9") {
          // Number key - direct selection
          const idx = stageOptions.findIndex((o) => o.key === key);
          if (idx !== -1) {
            selectedIndex = idx;
            renderStageMenu(selectedIndex);
            setTimeout(() => {
              cleanup();
              console.log("");
              resolve(stageOptions[selectedIndex].stage);
            }, 150);
          }
        }
      };

      const cleanup = (): void => {
        process.stdin.removeListener("data", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      };

      process.stdin.on("data", handleKeypress);
    });
  }

  private isFirstRender: boolean = true;

  /**
   * Render menu at current cursor position
   */
  private renderMenu(selectedIndex: number): void {
    if (!this.isFirstRender) {
      // Move back to start of menu and clear
      const lines = this.menuOptions.length + 3; // 3 header lines + N options
      process.stdout.write(`\x1b[${lines}A`); // Move up
      process.stdout.write("\x1b[J"); // Clear from cursor to end
    }
    this.isFirstRender = false;

    console.log("=".repeat(60));
    console.log(
      "  Deploy Menu - Use \x1b[1m↑↓\x1b[0m to select, \x1b[1mEnter\x1b[0m to confirm"
    );
    console.log("=".repeat(60));

    for (let i = 0; i < this.menuOptions.length; i++) {
      const opt = this.menuOptions[i];
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? "\x1b[36m❯\x1b[0m" : " ";
      const highlight = isSelected ? "\x1b[1m\x1b[36m" : "\x1b[90m";
      const reset = "\x1b[0m";
      console.log(
        `  ${prefix} ${highlight}${opt.label}${reset} - ${opt.description}`
      );
    }
  }

  /**
   * Show interactive menu and return selected option
   */
  public async show(): Promise<DeployOption> {
    let selectedIndex = 0;
    this.isFirstRender = true; // Reset for new menu display

    // Render menu for the first time
    this.renderMenu(selectedIndex);

    return new Promise((resolve) => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const handleKeypress = (key: string): void => {
        if (key === "\u001b[A" || key === "k") {
          // Up arrow or k
          selectedIndex =
            (selectedIndex - 1 + this.menuOptions.length) %
            this.menuOptions.length;
          this.renderMenu(selectedIndex);
        } else if (key === "\u001b[B" || key === "j") {
          // Down arrow or j
          selectedIndex = (selectedIndex + 1) % this.menuOptions.length;
          this.renderMenu(selectedIndex);
        } else if (key === "\r" || key === "\n" || key === " ") {
          // Enter or space
          cleanup();
          console.log("");
          resolve(this.menuOptions[selectedIndex].option);
        } else if (key === "\u0003" || key === "q") {
          // Ctrl+C or q
          cleanup();
          console.log("\nDeployment cancelled.");
          process.exit(0);
        } else if (key >= "0" && key <= "9") {
          // Number key - direct selection
          const idx = this.menuOptions.findIndex((o) => o.key === key);
          if (idx !== -1) {
            selectedIndex = idx;
            this.renderMenu(selectedIndex);
            setTimeout(() => {
              cleanup();
              console.log("");
              resolve(this.menuOptions[selectedIndex].option);
            }, 150);
          }
        }
      };

      const cleanup = (): void => {
        process.stdin.removeListener("data", handleKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
      };

      process.stdin.on("data", handleKeypress);
    });
  }
}
