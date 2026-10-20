import {
  Code2,
  HardDrive,
  Layers,
  Network,
  Settings,
  Sparkles,
  Terminal,
} from "lucide-react";
export const navigation = [
  {
    name: "Overview",
    icon: Layers,
    title: "Your machine, under the glass.",
    description:
      "A live look at your ports, processes, and AI agents. All in one place.",
  },
  {
    name: "Ports",
    icon: Network,
    title: "Every listener. A clearer picture.",
    description:
      "Inspect listening endpoints and the owners your machine makes visible.",
  },
  {
    name: "Processes",
    icon: Terminal,
    title: "What’s running right now.",
    description: "Inspect process metadata, sorted by current memory RSS.",
  },
  {
    name: "AI Agents",
    icon: Sparkles,
    title: "Agents, with evidence.",
    description:
      "Detected processes, with unverified activity clearly labeled.",
  },
  {
    name: "Dev Tools",
    icon: Code2,
    title: "Where your development memory goes.",
    description:
      "IDEs, SDKs, language runtimes, local services and container hosts, grouped from observed processes.",
  },
  {
    name: "Storage",
    icon: HardDrive,
    title: "Developer storage, accounted for.",
    description:
      "Inspect selected folders and local Docker usage. Review cleanup before making changes.",
  },
  {
    name: "Collectors",
    icon: Settings,
    title: "Observation, on your terms.",
    description:
      "Control what Portglass observes. Sensitive integrations stay off.",
  },
] as const;
export type Page = (typeof navigation)[number]["name"];
