import { dialog, shell } from "electron";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { ExternalApplication } from "../types";
import { getSettings, saveSettings } from "../manualSettingsStore";

const execAsync = promisify(exec);

export class ApplicationService {
  private static instance: ApplicationService;
  private applications: Map<string, ExternalApplication> = new Map();

  private constructor() {
    this.loadApplicationsFromSettings();
  }

  static getInstance(): ApplicationService {
    if (!ApplicationService.instance) {
      ApplicationService.instance = new ApplicationService();
    }
    return ApplicationService.instance;
  }

  private loadApplicationsFromSettings(): void {
    const settings = getSettings();
    for (const app of settings.hubMenu.customApplications) {
      this.applications.set(app.id, app);
    }
  }

  private saveApplicationsToSettings(): void {
    const currentSettings = getSettings();
    const updatedSettings = {
      ...currentSettings,
      hubMenu: {
        ...currentSettings.hubMenu,
        customApplications: Array.from(this.applications.values()),
      },
    };
    saveSettings(updatedSettings);
  }

  async getInstalledApplications(): Promise<ExternalApplication[]> {
    const detectedApps = await this.detectCommonApplications();
    const customApps = Array.from(this.applications.values());

    // Merge detected and custom applications, avoiding duplicates
    const allApps = [...detectedApps];
    for (const customApp of customApps) {
      if (
        !allApps.find((app) => app.executablePath === customApp.executablePath)
      ) {
        allApps.push(customApp);
      }
    }

    return allApps;
  }

  private async detectCommonApplications(): Promise<ExternalApplication[]> {
    const apps: ExternalApplication[] = [];

    // Windows common application detection
    if (process.platform === "win32") {
      const commonPaths = [
        // System programs
        { name: "Calculator", path: "calc.exe", icon: "🧮" },
        { name: "Notepad", path: "notepad.exe", icon: "📝" },
        { name: "Paint", path: "mspaint.exe", icon: "🎨" },
        { name: "Snipping Tool", path: "SnippingTool.exe", icon: "✂️" },
        { name: "Command Prompt", path: "cmd.exe", icon: "⌨️" },
        { name: "PowerShell", path: "powershell.exe", icon: "🔷" },
        { name: "File Explorer", path: "explorer.exe", icon: "📁" },

        // Common installation paths
        {
          name: "Google Chrome",
          path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          icon: "🌐",
        },
        {
          name: "Mozilla Firefox",
          path: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
          icon: "🦊",
        },
        {
          name: "Microsoft Edge",
          path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          icon: "🌐",
        },
        {
          name: "Visual Studio Code",
          path: "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
          icon: "💻",
        },
        {
          name: "Spotify",
          path: "C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe",
          icon: "🎵",
        },
        {
          name: "Discord",
          path: "C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\Update.exe",
          icon: "💬",
          arguments: ["--processStart", "Discord.exe"],
        },
      ];

      for (const commonApp of commonPaths) {
        let fullPath = commonApp.path;

        // Expand environment variables
        if (fullPath.includes("%USERNAME%")) {
          fullPath = fullPath.replace("%USERNAME%", process.env.USERNAME || "");
        }

        // Check if it's a system command (no full path)
        if (!fullPath.includes("\\") && !fullPath.includes("/")) {
          // System command, assume it exists
          apps.push({
            id: `system-${commonApp.name.toLowerCase().replace(/\s+/g, "-")}`,
            name: commonApp.name,
            executablePath: fullPath,
            arguments: commonApp.arguments,
            icon: commonApp.icon,
            color: "default",
            isCustom: false,
          });
        } else if (fs.existsSync(fullPath)) {
          apps.push({
            id: `detected-${commonApp.name.toLowerCase().replace(/\s+/g, "-")}`,
            name: commonApp.name,
            executablePath: fullPath,
            arguments: commonApp.arguments,
            icon: commonApp.icon,
            color: "default",
            isCustom: false,
          });
        }
      }
    }

    // macOS detection
    else if (process.platform === "darwin") {
      const commonApps = [
        {
          name: "Calculator",
          path: "/Applications/Calculator.app",
          icon: "🧮",
        },
        { name: "TextEdit", path: "/Applications/TextEdit.app", icon: "📝" },
        { name: "Safari", path: "/Applications/Safari.app", icon: "🌐" },
        {
          name: "Google Chrome",
          path: "/Applications/Google Chrome.app",
          icon: "🌐",
        },
        {
          name: "Visual Studio Code",
          path: "/Applications/Visual Studio Code.app",
          icon: "💻",
        },
        { name: "Spotify", path: "/Applications/Spotify.app", icon: "🎵" },
        { name: "Discord", path: "/Applications/Discord.app", icon: "💬" },
      ];

      for (const commonApp of commonApps) {
        if (fs.existsSync(commonApp.path)) {
          apps.push({
            id: `detected-${commonApp.name.toLowerCase().replace(/\s+/g, "-")}`,
            name: commonApp.name,
            executablePath: commonApp.path,
            icon: commonApp.icon,
            color: "default",
            isCustom: false,
          });
        }
      }
    }

    return apps;
  }

  async addCustomApplication(
    appData: Omit<ExternalApplication, "id" | "isCustom">
  ): Promise<ExternalApplication> {
    const id = `custom-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const app: ExternalApplication = {
      ...appData,
      id,
      isCustom: true,
    };

    this.applications.set(id, app);
    this.saveApplicationsToSettings();

    return app;
  }

  removeCustomApplication(appId: string): boolean {
    const app = this.applications.get(appId);
    if (app && app.isCustom) {
      this.applications.delete(appId);
      this.saveApplicationsToSettings();
      return true;
    }
    return false;
  }

  async launchApplication(appId: string): Promise<void> {
    const app =
      this.applications.get(appId) ||
      (await this.getInstalledApplications()).find((a) => a.id === appId);

    if (!app) {
      throw new Error(`Application with ID ${appId} not found`);
    }

    try {
      let command = app.executablePath;

      // Handle different platforms
      if (process.platform === "win32") {
        // Windows: use shell.openPath for .exe files or spawn for system commands
        if (
          app.executablePath.endsWith(".exe") &&
          fs.existsSync(app.executablePath)
        ) {
          await shell.openPath(app.executablePath);
        } else {
          // System command
          const args = app.arguments ? ` ${app.arguments.join(" ")}` : "";
          command = `${app.executablePath}${args}`;
          await execAsync(command, { cwd: app.workingDirectory });
        }
      } else if (process.platform === "darwin") {
        // macOS: use 'open' command
        if (app.executablePath.endsWith(".app")) {
          await execAsync(`open "${app.executablePath}"`);
        } else {
          await execAsync(app.executablePath, { cwd: app.workingDirectory });
        }
      } else {
        // Linux: direct execution
        await execAsync(app.executablePath, { cwd: app.workingDirectory });
      }

      console.log(`Successfully launched application: ${app.name}`);
    } catch (error) {
      console.error(`Failed to launch application ${app.name}:`, error);
      throw error;
    }
  }

  async browseForApplication(): Promise<Omit<
    ExternalApplication,
    "id" | "isCustom"
  > | null> {
    const fileFilter =
      process.platform === "win32"
        ? [{ name: "Executable Files", extensions: ["exe", "bat", "cmd"] }]
        : process.platform === "darwin"
        ? [{ name: "Applications", extensions: ["app"] }]
        : [{ name: "All Files", extensions: ["*"] }];

    const result = await dialog.showOpenDialog({
      title: "Select Application",
      filters: fileFilter,
      properties: ["openFile"],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath, path.extname(filePath));

    // Smart icon selection based on application name
    const icon = this.getIconForApplication(fileName, filePath);

    return {
      name: fileName,
      executablePath: filePath,
      icon: icon,
      color: "default",
    };
  }

  private getIconForApplication(fileName: string, filePath: string): string {
    const lowercaseName = fileName.toLowerCase();
    const lowercasePath = filePath.toLowerCase();

    // Browser applications
    if (lowercaseName.includes("chrome") || lowercaseName.includes("google")) {
      return "🌐";
    }
    if (
      lowercaseName.includes("firefox") ||
      lowercaseName.includes("mozilla")
    ) {
      return "🦊";
    }
    if (lowercaseName.includes("edge") || lowercaseName.includes("msedge")) {
      return "🌐";
    }
    if (lowercaseName.includes("brave")) {
      return "🦁";
    }
    if (lowercaseName.includes("opera")) {
      return "🎭";
    }
    if (lowercaseName.includes("safari")) {
      return "🧭";
    }
    if (lowercaseName.includes("vivaldi")) {
      return "🌐";
    }

    // Development tools
    if (lowercaseName.includes("code") || lowercaseName.includes("vscode")) {
      return "💻";
    }
    if (lowercaseName.includes("studio") || lowercaseName.includes("visual")) {
      return "🛠️";
    }
    if (lowercaseName.includes("atom")) {
      return "⚛️";
    }
    if (lowercaseName.includes("sublime")) {
      return "📝";
    }
    if (lowercaseName.includes("notepad") || lowercaseName.includes("text")) {
      return "📝";
    }
    if (lowercaseName.includes("intellij") || lowercaseName.includes("idea")) {
      return "🧠";
    }
    if (lowercaseName.includes("eclipse")) {
      return "🌙";
    }
    if (lowercaseName.includes("webstorm")) {
      return "🕸️";
    }
    if (lowercaseName.includes("pycharm")) {
      return "🐍";
    }

    // Media applications
    if (lowercaseName.includes("spotify")) {
      return "🎵";
    }
    if (lowercaseName.includes("vlc")) {
      return "🎬";
    }
    if (lowercaseName.includes("media") || lowercaseName.includes("player")) {
      return "🎥";
    }
    if (lowercaseName.includes("photo") || lowercaseName.includes("image")) {
      return "🖼️";
    }
    if (lowercaseName.includes("gimp")) {
      return "🎨";
    }
    if (lowercaseName.includes("photoshop")) {
      return "🎨";
    }
    if (lowercaseName.includes("illustrator")) {
      return "✏️";
    }
    if (lowercaseName.includes("premiere")) {
      return "🎬";
    }
    if (lowercaseName.includes("audacity")) {
      return "🎧";
    }

    // Communication
    if (lowercaseName.includes("discord")) {
      return "💬";
    }
    if (lowercaseName.includes("slack")) {
      return "💼";
    }
    if (lowercaseName.includes("teams")) {
      return "👥";
    }
    if (lowercaseName.includes("zoom")) {
      return "📹";
    }
    if (lowercaseName.includes("skype")) {
      return "📞";
    }
    if (lowercaseName.includes("telegram")) {
      return "✈️";
    }
    if (lowercaseName.includes("whatsapp")) {
      return "💬";
    }

    // Gaming
    if (lowercaseName.includes("steam")) {
      return "🎮";
    }
    if (lowercaseName.includes("game") || lowercaseName.includes("gaming")) {
      return "🎮";
    }
    if (lowercaseName.includes("origin")) {
      return "🎮";
    }
    if (lowercaseName.includes("epic")) {
      return "🎮";
    }
    if (lowercaseName.includes("minecraft")) {
      return "⛏️";
    }

    // Office applications
    if (lowercaseName.includes("word") || lowercaseName.includes("writer")) {
      return "📄";
    }
    if (lowercaseName.includes("excel") || lowercaseName.includes("calc")) {
      return "📊";
    }
    if (
      lowercaseName.includes("powerpoint") ||
      lowercaseName.includes("impress")
    ) {
      return "📈";
    }
    if (lowercaseName.includes("pdf")) {
      return "📕";
    }
    if (lowercaseName.includes("acrobat")) {
      return "📕";
    }
    if (lowercaseName.includes("outlook")) {
      return "📧";
    }
    if (lowercaseName.includes("onenote")) {
      return "📓";
    }

    // System tools
    if (
      lowercaseName.includes("terminal") ||
      lowercaseName.includes("cmd") ||
      lowercaseName.includes("powershell")
    ) {
      return "⌨️";
    }
    if (
      lowercaseName.includes("calculator") ||
      lowercaseName.includes("calc")
    ) {
      return "🧮";
    }
    if (lowercaseName.includes("paint")) {
      return "🎨";
    }
    if (lowercaseName.includes("file") || lowercaseName.includes("explorer")) {
      return "📁";
    }
    if (
      lowercaseName.includes("control") ||
      lowercaseName.includes("settings")
    ) {
      return "⚙️";
    }
    if (lowercaseName.includes("task") || lowercaseName.includes("manager")) {
      return "📊";
    }

    // Cloud storage
    if (lowercaseName.includes("dropbox")) {
      return "☁️";
    }
    if (lowercaseName.includes("drive") || lowercaseName.includes("google")) {
      return "💾";
    }
    if (lowercaseName.includes("onedrive")) {
      return "☁️";
    }
    if (lowercaseName.includes("box")) {
      return "📦";
    }

    // Security & VPN
    if (lowercaseName.includes("vpn")) {
      return "🔐";
    }
    if (
      lowercaseName.includes("antivirus") ||
      lowercaseName.includes("security")
    ) {
      return "🛡️";
    }

    // Utilities
    if (lowercaseName.includes("7zip") || lowercaseName.includes("winrar")) {
      return "📦";
    }
    if (lowercaseName.includes("torrent")) {
      return "⬇️";
    }

    // Default icon based on file extension or type
    if (lowercasePath.endsWith(".exe")) {
      return "💾";
    }
    if (lowercasePath.endsWith(".app")) {
      return "📱";
    }
    if (lowercasePath.endsWith(".bat") || lowercasePath.endsWith(".cmd")) {
      return "⚡";
    }

    // Fallback default icon
    return "📦";
  }
}
