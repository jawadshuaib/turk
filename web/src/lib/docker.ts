import Dockerode from "dockerode";
import { getApiKey, getCloudBaseUrl } from "@/lib/ollama";

const docker = new Dockerode({
  socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
});

const AGENT_IMAGE = "turk-openclaw";
const NETWORK_NAME = "turk_turk-net"; // docker compose prefixes with project name

interface StartConfig {
  turkId: string;
  targetUrl: string;
  instructions: string;
  ollamaModel: string;
  modelSource: string; // "local" or "cloud"
  credentials: Record<string, Record<string, string>>;
  projectObjective?: string;
  turkRole?: string;
}

function hostify(url: string): string {
  return url
    .replace("localhost", "host.docker.internal")
    .replace("127.0.0.1", "host.docker.internal");
}

export async function startTurkContainer(
  config: StartConfig
): Promise<string> {
  const containerName = `turk-agent-${config.turkId.slice(0, 8)}`;

  // Clean up any stale container with the same name
  try {
    const old = docker.getContainer(containerName);
    await old.stop({ t: 5 }).catch(() => {});
    await old.remove({ force: true });
  } catch {
    // no existing container, that's fine
  }

  // Determine Ollama URL based on model source
  const isCloud = config.modelSource === "cloud";
  const ollamaUrl = isCloud
    ? getCloudBaseUrl()
    : hostify(process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434");

  // Base64 encode instructions and credentials to avoid env var escaping issues
  const env = [
    `TURK_ID=${config.turkId}`,
    `TARGET_URL=${hostify(config.targetUrl)}`,
    `INSTRUCTIONS_B64=${Buffer.from(config.instructions).toString("base64")}`,
    `OLLAMA_MODEL=${config.ollamaModel}`,
    `OLLAMA_BASE_URL=${ollamaUrl}`,
    `MODEL_SOURCE=${config.modelSource || "local"}`,
    `WS_URL=${hostify(process.env.WS_URL || "ws://host.docker.internal:3124/api/ws")}`,
    `CREDENTIALS_B64=${Buffer.from(JSON.stringify(config.credentials)).toString("base64")}`,
  ];

  // Pass project context for research turks
  if (config.projectObjective) {
    env.push(`PROJECT_OBJECTIVE_B64=${Buffer.from(config.projectObjective).toString("base64")}`);
  }
  if (config.turkRole) {
    env.push(`TURK_ROLE_B64=${Buffer.from(config.turkRole).toString("base64")}`);
  }

  // Pass API key for cloud models (from DB or env)
  if (isCloud) {
    const apiKey = await getApiKey();
    if (apiKey) {
      env.push(`OLLAMA_API_KEY=${apiKey}`);
    }
  }

  // Named volume for persistent agent memory across runs
  const memoryVolume = `turk-memory-${config.turkId.slice(0, 12)}`;

  const container = await docker.createContainer({
    Image: AGENT_IMAGE,
    name: containerName,
    Env: env,
    HostConfig: {
      NetworkMode: NETWORK_NAME,
      ExtraHosts: ["host.docker.internal:host-gateway"],
      Memory: 3 * 1024 * 1024 * 1024, // 3GB (OpenClaw + Chromium need more)
      CpuQuota: 200000, // 2 CPUs
      ShmSize: 512 * 1024 * 1024, // 512MB shared memory for Chrome
      Binds: [
        `${memoryVolume}:/home/node/.openclaw/workspace/memory`,
      ],
    },
  });

  await container.start();
  return container.id;
}

export async function stopTurkContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 10 });
    await container.remove({ force: true });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404) {
      // Container already removed
      return;
    }
    throw err;
  }
}

export async function getContainerStatus(
  containerId: string
): Promise<string | null> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  } catch {
    return null;
  }
}

export async function getContainerLogs(
  containerId: string,
  tail = 100
): Promise<string> {
  try {
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return logs.toString();
  } catch {
    return "";
  }
}
