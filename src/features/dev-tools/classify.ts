import type { Process } from "../../types.ts";
export interface ToolGroup {
  name: string;
  category: string;
  processes: Process[];
  memoryMb: number;
  cpu: number;
  direct: number;
}
function signature(name: string): [string, string] | null {
  const n = name.toLowerCase();
  if (/^(code|visual studio code|code helper)(\b|$)/.test(n))
    return ["Visual Studio Code", "IDEs"];
  if (/^(cursor|cursor helper)(\b|$)/.test(n)) return ["Cursor", "IDEs"];
  if (
    /^(webstorm|pycharm|idea|intellij idea|goland|rustrover|clion|rider|datagrip|phpstorm|rubymine)(64)?$/.test(
      n,
    )
  )
    return ["JetBrains IDEs", "IDEs"];
  if (/^(studio|studio64|android studio)$/.test(n))
    return ["Android Studio", "Android"];
  if (
    /^(xcode|sourcekitservice|sourcekit-lsp|xcbuild|xcbuildservice|xcodebuild|ibtoold|ibtool|actool|swift-frontend)$/.test(
      n,
    )
  )
    return ["Xcode & Swift tooling", "Apple development"];
  if (
    /^(simulator|simulatord|coresimulatorservice|com\.apple\.coresimulator\..*)$/.test(
      n,
    )
  )
    return ["Apple simulators", "Apple development"];
  if (/^(adb|emulator|sdkmanager|avdmanager)$/.test(n))
    return ["Android SDK & emulator", "Android"];
  if (/^(redis-server|redis-stack-server|redis-sentinel)$/.test(n))
    return ["Redis", "Services"];
  if (/^(postgres|postmaster)$/.test(n)) return ["PostgreSQL", "Services"];
  if (/^(mysqld|mariadbd)$/.test(n)) return ["MySQL / MariaDB", "Services"];
  if (/^(mongod|mongos)$/.test(n)) return ["MongoDB", "Services"];
  if (/^(colima|limactl|lima|lima-hostagent)$/.test(n))
    return ["Colima / Lima", "Container runtimes"];
  if (/^(orbstack|orb|orbstack helper.*)$/.test(n))
    return ["OrbStack", "Container runtimes"];
  if (/^(docker|dockerd|containerd|com\.docker\..*)$/.test(n))
    return ["Docker", "Container runtimes"];
  if (/^(qemu-system-.*|vfkit|virtualization|vmm)$/.test(n))
    return ["Virtual machines", "Virtualization"];
  if (/^(zed|zed helper.*)$/.test(n)) return ["Zed", "IDEs"];
  if (/^(node|bun|deno)$/.test(n))
    return ["JavaScript runtimes", "Language runtimes"];
  if (/^python(3(\.\d+)?)?$/.test(n))
    return ["Python runtimes", "Language runtimes"];
  if (/^(java|javaw)$/.test(n))
    return ["Java runtime · unassigned", "Language runtimes"];
  if (/^(codex|codex-cli|claude|gemini|opencode)$/.test(n))
    return ["AI coding agents", "Agents"];
  return null;
}
export function groupDevTools(processes: Process[]): ToolGroup[] {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const groups = new Map<string, ToolGroup>();
  for (const process of processes) {
    let match = signature(process.name);
    const direct = !!match;
    // Attribute generic runtimes/helpers to a known parent IDE/service when
    // ancestry is visible in this same snapshot. Never cross a numeric UID.
    let parent = process;
    const visited = new Set([process.pid]);
    for (
      let depth = 0;
      depth < 16 &&
      (!direct ||
        match?.[1] === "Language runtimes" ||
        match?.[1] === "Virtualization");
      depth++
    ) {
      const ancestor = byPid.get(parent.parent);
      if (
        !ancestor ||
        ancestor.uid !== process.uid ||
        visited.has(ancestor.pid)
      )
        break;
      visited.add(ancestor.pid);
      parent = ancestor;
      const owner = signature(ancestor.name);
      if (
        owner &&
        owner[1] !== "Language runtimes" &&
        owner[1] !== "Virtualization"
      ) {
        match = owner;
        break;
      }
    }
    if (!match) continue;
    const [name, category] = match;
    const group = groups.get(name) ?? {
      name,
      category,
      processes: [],
      memoryMb: 0,
      cpu: 0,
      direct: 0,
    };
    group.processes.push(process);
    group.memoryMb += process.memoryMb;
    group.cpu += process.cpu;
    group.direct += direct ? 1 : 0;
    groups.set(name, group);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      processes: group.processes.sort((a, b) => b.memoryMb - a.memoryMb),
    }))
    .sort((a, b) => b.memoryMb - a.memoryMb);
}
