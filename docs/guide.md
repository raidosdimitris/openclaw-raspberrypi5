# OpenClaw on Raspberry Pi 5 — Installation & Security Hardening Guide

## Table of Contents

- [Hardware](#hardware): The hardware used for this setup
- [Phase 0 — Concepts & Context](#phase-0--concepts--context): What OpenClaw is, why network isolation is non-negotiable, the "assume breach" mindset, key terminology, defense in depth, sandboxing, and architecture overview.
- [Phase 1 — Network Preparation](#phase-1--network-preparation): Physical network layout with a GL.iNet Mango router, creating an isolated subnet, hardening the router, and configuring laptop network profiles.
- [Phase 2a — Raspberry Pi OS Installation](#phase-2a--raspberry-pi-os-installation--hardening): Flashing the OS, SSH key setup, first boot, migrating to NVMe SSD.
- [Phase 2b — Raspberry Pi OS Hardening](#phase-2b--raspberry-pi-os-hardening): Locking down SSH, firewall (UFW), fail2ban, creating the dedicated `openclaw` user, disabling unnecessary services, automatic security updates, swap verification, static IP.
- [Phase 3 — Ollama Installation & Local Model Setup](#phase-3--ollama-installation--local-model-setup): Installing Ollama, downloading local models (`qwen3:1.7b`, `qwen3:8b`, `gemma3:1b`), context window tuning, security considerations for local models.
- [Phase 4 — OpenClaw Installation & Security Hardening](#phase-4--openclaw-installation--security-hardening): Installing dependencies (Node.js, Docker), installing OpenClaw, running the onboarding wizard, building the sandbox Docker image, hardening the configuration, security audit.
- [Phase 5 — Telegram Channel Setup & Local Model Configuration](#phase-5--telegram-channel-setup--local-model-configuration): Creating a Telegram bot, configuring the DM allowlist, enabling the Telegram plugin, registering Ollama models as explicit providers.
- [Phase 6 — Setting Up OpenClaw for Coding & Research](#phase-6--setting-up-openclaw-for-coding--research): Dedicated GitHub account, workspace backup, Brave Search API, sandbox GitHub credentials, full coding workflow test, safe review habits.
- [Phase 6.5 — Google Drive Access for Document Sharing](#phase-65-google-drive-access-for-document-sharing): Installing rclone, authenticating with a dummy Google account, custom sandbox image with rclone, bind-mounting credentials, testing uploads.
- [Phase 7 — Ongoing Maintenance & Monitoring](#phase-7--ongoing-maintenance--monitoring): Maintenance checklist (rotation schedules, updates, backups) and incident response protocol. *(Detailed walkthroughs planned for a future update.)*
- [Phase 8 — Tailscale Remote Access & Control UI Setup](#phase-8-tailscale-remote-access--control-ui-setup): Installing Tailscale, Tailscale Serve for the Control UI, firewall rules for Tailscale SSH, device pairing, convenience aliases.

---

# Hardware

| Component | Model | Key Specs |
|---|---|---|
| Single-board computer | Raspberry Pi 5 | 16 GB RAM |
| Storage (primary) | Official Raspberry Pi NVMe SSD | 1 TB, M.2 NVMe |
| Case | Argon NEO 5 NVMe | M.2 bottom-mount, passive cooling |
| Power supply | Official Raspberry Pi USB-C PSU | 27 W |
| Storage (recovery) | microSD card | For initial OS flashing / recovery |
| Isolation router | GL.iNET GL-MT300N-V2 (Mango) | Portable VPN router, OpenWrt, 100 Mbps Ethernet |
| Networking | Ethernet cables × 2 | Main router → Mango WAN, Mango LAN → Pi |

# Phase 0 — Concepts & Context

**What this phase covers:** A conceptual foundation for running OpenClaw on a network-isolated Raspberry Pi 5. No hardware, no commands — just the mental model you need before building anything.

**Prerequisites:** None. This is the starting point.

---

## 1. What Is OpenClaw?

OpenClaw is an open-source AI agent you self-host on your own hardware. You interact with it through messaging apps (Telegram, Signal, WhatsApp, Discord, etc.) and it responds like a chatbot — but with a critical difference: **it can take real actions on the computer it runs on.**

Specifically, OpenClaw can:

- Execute shell commands on its host machine
- Read and write files
- Browse websites
- Use downloadable extensions called "skills"
- Send messages on your behalf
- Write code, run it, and iterate on it

---

## 2. What Is a Raspberry Pi, and Why Use One?

A Raspberry Pi is a small, inexpensive single-board computer (roughly credit-card-sized) that runs Linux. Your Pi 5 with 16 GB of RAM is a capable machine for this workload.

**Why it's ideal for OpenClaw:** It is a separate, dedicated device. It is not your laptop or your phone. If something goes wrong with OpenClaw, the damage is contained to this box — not spread across your personal life. Think of it as giving your AI assistant its own apartment rather than letting it move into your house.

---

## 3. Key Terminology

These terms will recur throughout every phase of the setup.

| Term | Definition | Analogy |
|------|-----------|---------|
| **IP address** | A number that identifies a device on a network (e.g., `192.168.1.50`). | A postal address for a computer. |
| **Local network** | All devices connected to your home router (Wi-Fi and Ethernet). By default, they can see and communicate with each other. | Everyone living in the same house. |
| **VLAN (Virtual LAN)** | A way to create separate, isolated networks within one router. Devices on one VLAN cannot talk to devices on another. | Two buildings sharing a street address but with no connecting doors. |
| **Guest network** | A simpler form of network isolation available on many home routers. Provides internet access but blocks communication with the main network. | A guest house on the same property — Wi-Fi works, but no access to the main house. |
| **SSH (Secure Shell)** | A protocol for remotely controlling a computer via encrypted text commands. You'll use this from your laptop to administer the Pi without plugging in a keyboard and monitor. | A secure phone line to the Pi's command center. |
| **Firewall (UFW)** | Software that controls which network traffic is allowed in or out of a device. UFW = "Uncomplicated Firewall." | A bouncer at a door who checks every visitor against a list. |
| **Localhost (`127.0.0.1`)** | A special IP address meaning "this device only." When OpenClaw binds to localhost, it only accepts connections from the Pi itself — not from the network. | A door that only opens from the inside. |
| **Port** | A numbered endpoint on a device. A single IP can run many services, each on a different port. OpenClaw's gateway defaults to port `18789`. | If the IP address is a street address, the port is the apartment number. |
| **API key** | A secret credential that lets OpenClaw communicate with a cloud service (e.g., Anthropic's Claude API). Anyone with this key can use the service and incur charges. | A credit card number for an AI service — must be kept secret and have a spending limit. |
| **NVMe SSD vs. SD card** | Two storage options for the Pi. The SD card is small and slow; the NVMe SSD (1 TB, in the Argon NEO 5 case) is dramatically faster and more durable. We'll start on SD, then migrate to NVMe. | SD card = flash drive. NVMe = proper hard drive. |
| **Prompt injection** | An attack where hidden instructions are embedded in content that the AI reads (a webpage, a file, a message). The AI may follow those hidden instructions instead of yours. | Someone slipping a forged note into a stack of your legitimate mail. |
| **Docker container** | A lightweight, isolated environment running inside your computer. It has its own file system and programs, separate from the host. Containers can be created and destroyed in seconds. | A sealed plastic box on your workbench — tools inside can't reach the drawers. |
| **Sandboxing** | Running OpenClaw's tool commands inside Docker containers instead of directly on the Pi, so damage from a compromised action stays contained. | Making your assistant do all their work inside the plastic box rather than loose in the workshop. |

---

## 4. Why Network Isolation Is Non-Negotiable

**The analogy to keep in mind throughout this project:**

> Your home network is your house. Your laptop, phone, smart TV, and NAS are your family living inside. OpenClaw is a capable but not fully trusted employee. You wouldn't give them a key to the house — you'd set them up in a separate office out back, with its own entrance and no connecting door to the main building.

That "separate office" is what we create through network isolation (VLAN or guest network). The Pi gets internet access (for the Anthropic API and approved websites) but **cannot see or communicate with any device on your main network.**

### Why OpenClaw needs isolation but your phone doesn't

The Pi running OpenClaw has a categorically different risk profile from your personal devices:

| Factor | Your Phone | Pi Running OpenClaw |
|--------|-----------|-------------------|
| **Designed to execute instructions from external content?** | No | Yes — that is its core function |
| **Frequency of adversarial input?** | Occasional (phishing email, sketchy link) | Regular — every web browse, every file read, every message processed |
| **Can run shell commands based on content it reads?** | No — browser and apps are sandboxed by the OS | Yes — that is how it works |
| **OS security investment?** | Billions of dollars (Apple / Google) | Basic Linux + your manual configuration |
| **Built-in app sandboxing?** | Yes, by default | Optional — we must enable it |

Your phone *might* get compromised if something goes very wrong. OpenClaw *will* encounter adversarial content routinely — and it is designed to act on what it reads. The isolation ensures that even a successful attack is contained.

### What your router does — and doesn't do

Your home router blocks **inbound threats from the internet** (via NAT and a basic firewall). But it does **not** protect devices on your network from each other. Once a device is connected to your Wi-Fi or Ethernet, the router treats it as trusted. Every device on the same local network can typically discover and communicate with every other device.

This means a compromised Pi on an un-isolated network could: scan for other devices, attempt to access file shares and admin panels, exploit vulnerabilities in smart home devices, or use your network as a launching point.

Network isolation closes this gap. The Pi can reach the internet but cannot reach your laptop, phone, NAS, or anything else on the main network.

### SSH access does not break isolation

You will still need to administer the Pi from your laptop via SSH. This does not violate the isolation model. The concern is the **Pi reaching your devices** (outbound from Pi to main network), not you reaching the Pi. We'll configure a narrow firewall rule that allows your laptop to SSH into the Pi while blocking the Pi from initiating any connections to the main network.

Alternatively, **Tailscale** (a free encrypted overlay network) can provide SSH access from your laptop to the Pi regardless of network segmentation, while the OpenClaw gateway remains bound to localhost. The OpenClaw docs explicitly support this: *"gateway.bind must stay loopback when Serve/Funnel is enabled."*

---

## 5. The "Assume Breach" Mindset

> **"Assume breach" means:** design your setup so that even if OpenClaw is compromised, the damage is limited and manageable.

This is not pessimism — it is standard practice in security engineering. You are running an AI agent with shell access, web access, and file access. The OpenClaw project publishes its own threat model (a good sign of transparency), and it documents specific, rated attack chains:

### Critical and high-severity attack chains from OpenClaw's threat model

**Attack Chain 1 — Prompt Injection → Remote Code Execution (Critical)**
Someone hides malicious instructions in a webpage → OpenClaw fetches and reads the page → the AI follows the hidden instructions → runs commands on the Pi.

- Threat IDs: `T-EXEC-001` → `T-EXEC-004` → `T-IMPACT-001`
- OpenClaw's own residual risk rating: **Critical**

**Attack Chain 2 — Malicious Skill → Credential Theft (Critical)**
A malicious skill (extension) is published to ClawHub → user installs it → hidden code harvests API keys or other credentials.

- Threat IDs: `T-PERSIST-001` → `T-EVADE-001` → `T-EXFIL-003`
- OpenClaw's own residual risk rating: **Critical**

**Attack Chain 3 — Indirect Injection via Fetched Content (High)**
A website OpenClaw visits for research contains hidden instructions → OpenClaw follows them → data is exfiltrated to an attacker-controlled server.

- Threat IDs: `T-EXEC-002` → `T-EXFIL-001`
- OpenClaw's own residual risk rating: **High**

These are not hypothetical. They are documented in the project's own `THREAT-MODEL-ATLAS.md` and mapped to the MITRE ATLAS framework for AI/ML threats.

---

## 6. Defense in Depth — The Security Layers

No single layer is perfect. Together, they make a breach very hard to turn into real damage.

| Layer | What It Does | What It Mitigates |
|-------|-------------|-------------------|
| **Network isolation** (VLAN / guest network) | Pi cannot communicate with personal devices | Compromised Pi scanning/attacking your main network |
| **Localhost binding** (`gateway.bind: "loopback"`) | OpenClaw only accepts connections from the Pi itself | Attackers on the network connecting to the gateway |
| **Firewall (UFW)** | Blocks all unexpected incoming connections at the OS level | Port scanning, unauthorized access attempts |
| **Docker sandboxing** (`sandbox.mode: "all"`) | Tool commands run in isolated containers, not on the real Pi | Malicious commands accessing the Pi's real file system, API keys, or config |
| **Tool policy** (`tools.allow` / `tools.deny`) | OpenClaw can only use specifically permitted tools | Agent using tools you didn't intend to expose |
| **Exec approvals** | Destructive or system-altering commands require your confirmation | Agent running dangerous commands without oversight |
| **DM allowlist** (`dmPolicy: "allowlist"`) | Only your account can message OpenClaw | Strangers sending commands or prompt injections via DM |
| **Dedicated accounts** | GitHub, etc. accounts created solely for OpenClaw | If a token leaks, it's a throwaway — not your personal account |
| **API billing limits** | Spending cap configured in the Anthropic Console | Runaway costs if the API key is leaked or the agent loops |

---

## 7. Local Models vs. Cloud API

You will use two types of AI models:

**Local model (via Ollama on the Pi):** A small model (e.g., `qwen3:1.7b` or `gemma3:1b`) running directly on the Pi's hardware. Free, private, and fast for simple tasks — but limited in reasoning ability.

**Cloud model (via Anthropic API with Claude):** A large, powerful model accessed over the internet. Excellent at complex reasoning and coding but costs money per use and requires sending data to Anthropic's servers.

**The key security nuance from OpenClaw's documentation:** Smaller, less capable models are more susceptible to prompt injection. They have weaker "judgment" about distinguishing legitimate instructions from embedded attacks. **Use the strongest available model (Claude) for any work that involves tools** — i.e., any task where the AI is actually executing commands, writing files, or browsing. Reserve the local model for lightweight tasks like summarization or orchestration where it has no tool access.

---

## 8. Sandboxing in Detail

### The problem sandboxing solves

Without sandboxing, every command OpenClaw runs executes directly on the Pi with full access to the Pi's file system, API keys, configuration, and anything else on the machine. If OpenClaw gets tricked by a prompt injection, the malicious command has the same access.

### What Docker sandboxing does

With sandboxing enabled, OpenClaw runs tool commands inside a Docker container — an isolated environment with its own file system and no default access to the host's real files or network.

```
You: "Create a to-do app in React"
         │
         ▼
   OpenClaw decides to use exec and write tools
         │
         ▼
   ┌─────────────────────────────────┐
   │     Docker Container (sandbox)   │
   │                                  │
   │  ✅ Can create/edit code files   │
   │  ✅ Can run npm install          │
   │  ✅ Can start a dev server       │
   │  ❌ Cannot read Pi's real files  │
   │  ❌ Cannot access API keys       │
   │  ❌ Cannot access the network*   │
   │  ❌ Cannot modify OpenClaw config│
   └─────────────────────────────────┘

   * Sandbox containers default to no network access.
```

If the command turns out to be malicious, the damage is confined to the disposable container. Delete it and make a new one.

### The three-layer security model

OpenClaw uses three stacking controls for tool execution:

| Layer | Config path | What it decides | Example |
|-------|------------|-----------------|---------|
| **Tool Policy** | `tools.allow` / `tools.deny` | Which tools OpenClaw can use at all | "OpenClaw may use `exec` and `write` but NOT `browser`" |
| **Sandbox** | `agents.defaults.sandbox.mode` | Where permitted tools run (host vs. container) | "When `exec` runs, do it inside Docker, not on the real Pi" |
| **Elevated** | `tools.elevated` | Escape hatch — specific commands that must run on the host even when sandboxing is on | Rare; used sparingly for commands that genuinely need host access |

These layers are evaluated in order: tool policy first (is it allowed?), then sandbox (where does it run?), then elevated (does it get a host-access exception?).

### Sandbox modes

| Mode | Behavior | Recommended for |
|------|----------|-----------------|
| `"off"` | Everything runs directly on the Pi | **Not recommended** |
| `"non-main"` | Your primary chat session runs on the host; all other sessions run sandboxed | Reasonable middle ground |
| `"all"` | Everything runs in containers | **Maximum isolation — recommended for this setup** |

### Honest caveat from the docs

> *"This is not a perfect security boundary, but it substantially limits filesystem and process access when the model does something dumb."*

Sandboxing is one strong layer. Combined with network isolation, a firewall, tool policy, and exec approvals, it forms part of a defense-in-depth strategy where no single layer needs to be perfect.

---

## 9. Architecture Overview

This is what the completed setup will look like:

```
┌──────────────────────────────────────────────────┐
│            YOUR HOME NETWORK (main)              │
│                                                  │
│   💻 Laptop    📱 Phone    📺 Smart TV    🗄 NAS │
│                                                  │
│           ❌ NO connection to Pi ❌               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│         ISOLATED NETWORK (Pi's "office")         │
│                                                  │
│   🍓 Raspberry Pi 5 (16 GB RAM, 1 TB NVMe)     │
│   ├── OpenClaw (gateway bound to localhost only) │
│   ├── Ollama (local AI model for light tasks)    │
│   ├── Docker (sandbox for tool execution)        │
│   ├── UFW Firewall (deny all incoming)           │
│   └── Signal / Telegram (channel to you)         │
│                                                  │
│   🌐 Internet access (outbound only):            │
│       → Anthropic API (Claude, with billing cap) │
│       → Whitelisted research websites            │
│       → Dedicated GitHub account                 │
└──────────────────────────────────────────────────┘

You interact via messaging app (Signal/Telegram).
You administer via SSH or Tailscale.
```

---

## Phase 0 Checklist

Before proceeding to Phase 1 (Network Preparation), confirm you understand these concepts:

- [ ] OpenClaw is an AI agent that executes real commands, browses the web, and writes code — it needs guardrails
- [ ] The Raspberry Pi is a dedicated, isolated host — keeping OpenClaw separate from personal devices
- [ ] Network isolation means the Pi cannot communicate with your laptop, phone, NAS, or other home devices
- [ ] Your router protects against internet threats but does **not** isolate devices from each other by default
- [ ] "Assume breach" = design so that even a fully compromised Pi cannot damage your personal devices or accounts
- [ ] Prompt injection (hidden instructions in content the AI reads) is the highest-rated threat in OpenClaw's threat model
- [ ] Smaller local models are for lightweight, tool-free tasks only; Claude handles all tool-enabled work
- [ ] Sandboxing runs tool commands in disposable Docker containers instead of directly on the Pi
- [ ] Defense in depth: network isolation + localhost binding + firewall + sandbox + tool policy + exec approvals + DM allowlist + dedicated accounts + API billing limits

---

# Phase 1 — Network Preparation

**What this phase accomplishes:** Creates a network-isolated subnet for the Raspberry Pi so that even if OpenClaw is compromised, the blast radius cannot reach personal devices (laptops, phones, smart home, NAS) on the main network.

## Prerequisites

- Completed Phase 0 (Concepts & Context) — you understand *why* network isolation matters.
- Access to your main router's admin panel.
- A working internet connection.

## Hardware Required

| Item | Purpose | Approx. Cost (UK) |
|---|---|---|
| GL.iNet GL-MT300N-V2 "Mango" travel router | Creates an isolated subnet for the Pi. 2.4 GHz Wi-Fi only — adequate for this use case (the Pi connects via Ethernet; you only use the Wi-Fi for occasional laptop management before Tailscale is set up). | ~£20–25 |
| 2× short Ethernet cables (Cat 5e or Cat 6, 0.5m–1m) | Physical connections between routers and Pi | ~£3–5 each |

> **Why the GL.iNet Mango?** It runs OpenWrt (a well-regarded open-source router OS) out of the box, has a solid default firewall, tiny footprint, and low power draw. Its default firewall blocks all incoming connections from the WAN side.

## Steps

### 1. Physical Network Layout

Connect the hardware in this topology:

```
[Wall socket] → [Main Router]
                        |
                   LAN port (any of ports 1–4)
                        |
                  Ethernet Cable A
                        |
                   WAN port on GL.iNet Mango
                        |
                   LAN port on GL.iNet Mango
                        |
                  Ethernet Cable B
                        |
                  [Raspberry Pi 5]
```

**How this isolates the Pi:** The secondary router performs NAT (Network Address Translation), a one-way boundary. The main router assigns addresses on `192.168.1.x`; the GL.iNet assigns addresses on `192.168.8.x`. Devices on `192.168.1.x` cannot initiate connections to devices on `192.168.8.x`. The Pi can reach the internet (outbound), but nothing on the main network can reach inward to the Pi.

> **Note:** Do not power on or connect the Pi yet. Leave Cable B disconnected from the Pi until Phase 2.

### 2. Power On and Boot the GL.iNet Mango

1. Plug the GL.iNet's USB power cable into a USB power source (a phone charger works).
2. Plug **Cable A** from any LAN port on the main router into the **WAN** port on the GL.iNet.
3. Wait approximately 60 seconds for the GL.iNet to boot.

### 3. Access the GL.iNet Admin Panel

1. On your laptop or phone, connect to the GL.iNet's WiFi network. It broadcasts as `GL-MT300N-V2-xxx`. The default password is `goodlife` (printed on the bottom of the device).
2. Open a browser and navigate to `http://192.168.8.1`.
3. Set a **strong, unique admin password** when prompted. Record it securely. This password controls all router settings.

### 4. Verify Internet Connectivity

In the GL.iNet admin panel dashboard, confirm the router has internet access. It should show a connected status — the GL.iNet automatically obtains an IP from the main router via DHCP.

### 5. Harden the GL.iNet

While in the admin panel:

#### 5a. Set a Strong WiFi Password

Navigate to **Wireless** settings. Change the WiFi password to a strong, unique passphrase.

> **Critical:** This password must be **different** from your main WiFi password. If they're the same, anyone who knows your main WiFi password can also access the Pi's isolated network, defeating the purpose of isolation.

> **Note:** For maximum security, consider disabling the GL.iNet's WiFi entirely after Phase 2 is complete, since the Pi connects via Ethernet and SSH management can be done via Tailscale (Phase 8+).

#### 5b. UPnP — No Action Required

UPnP is **not installed by default** on the GL.iNet Mango. The `luci-app-upnp` package would need to be deliberately installed before it could run. You are already in the safe state.

> **Why this matters:** UPnP (Universal Plug and Play) lets devices automatically open ports on the router, the opposite of what we want for isolation.

#### 5c. Leave the Default Firewall Intact

The GL.iNet's default firewall blocks all incoming connections from the WAN side. Do not modify it.

### 6. Configure Your Laptop's Network Settings

Your laptop will connect to **two** WiFi networks at different times: the main router (for normal internet) and the GL.iNet (for SSH access to the Pi). Each network requires **different** TCP/IP settings.

> **Why this matters:** If both networks are configured with the same static IP settings, your laptop will try to use the GL.iNet's subnet addresses (e.g. `192.168.8.x`) on the main router's network (`192.168.1.x`), causing the main WiFi connection to fail entirely.

#### 6a. Main Router WiFi — Use Automatic (DHCP) Settings

These instructions are for macOS. Adapt for your OS.

1. Open **System Settings → Wi-Fi**.
2. Find your main network and click **Details…**
3. Click **TCP/IP** in the sidebar.
4. Set **Configure IPv4** to **Using DHCP**.
5. Click **DNS** in the sidebar. Remove any manually entered DNS servers (the router will provide them automatically).
6. Set **Configure IPv6** to **Automatically**.
7. Under **Private Wi-Fi Address**, set to **Rotating** or **Fixed** (not Off).
8. Click **OK**.

#### 6b. GL.iNet WiFi — Use Static IP Settings

1. Connect to the GL.iNet WiFi network.
2. Open **System Settings → Wi-Fi**.
3. Click **Details…** next to the GL.iNet network.
4. Click **TCP/IP** in the sidebar.
5. Set **Configure IPv4** to **Manually**.
6. Enter:
   - **IP Address:** `<YOUR_LAPTOP_IP>` (e.g. `192.168.8.170` — must be in the `192.168.8.2–254` range)
   - **Subnet Mask:** `255.255.255.0`
   - **Router:** `192.168.8.1`
7. Click **DNS** in the sidebar. Set the DNS server to `192.168.8.1`.
8. Click **OK**.

> **Why a static IP?** In Phase 2, the Pi's firewall (UFW) will be configured to allow SSH only from a specific IP address. A static IP ensures your laptop always gets the same address on the GL.iNet network, so the firewall rule works reliably.

> **Important:** The Pi's static IP (assigned in Phase 2) must be different from the laptop's. For example, if the laptop is `192.168.8.170`, the Pi could be `192.168.8.160`. Neither can be `192.168.8.1` (that's the router).

### 7. Disconnect from GL.iNet, Reconnect to Main WiFi

After configuring both network profiles:

1. Disconnect from the GL.iNet WiFi.
2. Connect to your main WiFi.
3. Open a browser and confirm a website loads (e.g. `google.co.uk`).
4. Verify: go to **System Settings → Wi-Fi → Details… → TCP/IP** and confirm the IP address starts with `192.168.1.` (assigned by your main router via DHCP).

## Verification

| Test | Expected Result |
|---|---|
| GL.iNet admin panel (`http://192.168.8.1`) accessible when on GL.iNet WiFi | Dashboard loads, shows internet connected |
| Main WiFi connects and has internet on laptop | Websites load; IP starts with `192.168.1.` |
| Switching between networks works cleanly | Each network uses its own IP settings (DHCP on your main router, static on GL.iNet) |

> **Network isolation ping test** will be performed in Phase 2 once the Pi is running: from the laptop on the main network, a `ping` to the Pi's `192.168.8.x` address should **fail** (time out / no response). This confirms the isolation boundary.

## Troubleshooting

### Laptop cannot connect to main WiFi after configuring the GL.iNet network

**Probable Cause:** The same static IP/subnet/gateway values from the GL.iNet were accidentally applied to the main WiFi profile. The laptop tells the main router "my address is `192.168.8.x`" which is on the wrong subnet.

**Fix:** Open **System Settings → Wi-Fi → Details…** for the main network → **TCP/IP** → change **Configure IPv4** to **Using DHCP**. Remove any manual DNS entries. If it still won't connect, click **Forget This Network**, then rejoin fresh.

### Intermittent WiFi drops on the GL.iNet network

**Likely causes and fixes:**

1. **WiFi channel interference:** The GL.iNet Mango only supports 2.4 GHz, which is crowded. In the GL.iNet admin panel (**Wireless** settings), manually set the channel to **1** or **11** — whichever is farthest from the channel your main router's 2.4 GHz band uses. The best non-overlapping 2.4 GHz channels are 1, 6, and 11.

2. **macOS auto-switching:** macOS may try to switch to a "better" network. In **System Settings → Wi-Fi → Details…** for the GL.iNet network, ensure **Auto Join** is ON, and turn off **Limit IP Address Tracking** and **Low Data Mode**.

3. **Mango hardware limitation:** The GL.iNet Mango is a tiny travel router with a small antenna. Minor drops are inherent to the hardware and Tailscale will be configured in a later phase to allow SSH from the main network without connecting to the GL.iNet WiFi at all.

## Phase 1 Checklist

- [ ] GL.iNet Mango (or equivalent secondary router) purchased
- [ ] Two short Ethernet cables ready
- [ ] Cable A connected: main router LAN port → GL.iNet WAN port
- [ ] GL.iNet powered on and has internet (confirmed via admin panel)
- [ ] GL.iNet admin password set to a strong, unique value
- [ ] GL.iNet WiFi password set to a strong, unique value (**different** from main WiFi)
- [ ] GL.iNet default firewall left intact (no modifications)
- [ ] Laptop: main WiFi profile set to DHCP (automatic)
- [ ] Laptop: GL.iNet WiFi profile set to static IP (unique, in `192.168.8.x` range)
- [ ] Laptop connects to main WiFi with internet access
- [ ] Cable B ready (not yet connected to Pi — that happens in Phase 2)


# Phase 2a — Raspberry Pi OS Installation & Hardening

Install Raspberry Pi OS on a microSD card, migrate to an NVMe SSD for performance and reliability, then harden the OS to minimise the attack surface before installing any application software.

---

## Prerequisites

Before starting this phase, you should have completed:

- **Phase 0 — Concepts & Context:** You understand what OpenClaw is, why network isolation matters, and the "assume breach" mindset.
- **Phase 1 — Network Preparation:** An isolated network segment (VLAN, guest network, or separate router) is operational. The Pi will connect to this segment only.
- **Hardware assembled:** The Raspberry Pi 5 is seated in the Argon NEO 5 NVMe case, the 1 TB NVMe SSD is installed in the M.2 slot on the bottom of the case, and the thermal pad makes contact between the Pi's processor and the aluminium lid. *(Search YouTube for "Argon NEO 5 NVMe assembly" for visual walkthroughs.)*

---

## Part A — Flash the OS & First Boot

### Step 1: Install Raspberry Pi Imager

Download and install **Raspberry Pi Imager** from [raspberrypi.com/software](https://www.raspberrypi.com/software/) on your laptop/desktop (Windows, macOS, or Linux).

### Step 2: Generate an SSH key pair

SSH (Secure Shell) lets you control the Pi remotely. SSH keys are a cryptographic lock-and-key pair that replace passwords — they are essentially impossible to brute-force.

On your laptop/desktop terminal (Terminal on macOS/Linux; PowerShell on Windows 10/11):

```bash
ssh-keygen -t ed25519 -C "openclaw-pi"
```

| Flag | Meaning |
|---|---|
| `-t ed25519` | Use the Ed25519 algorithm (modern, fast, very secure) |
| `-C "openclaw-pi"` | A label so you remember what this key is for |

When prompted:

- **File location:** Press Enter to accept the default (`~/.ssh/id_ed25519`).
- **Passphrase:** Set one — it protects the key file on your laptop.

This creates two files:

| File | Purpose | Share it? |
|---|---|---|
| `~/.ssh/id_ed25519` | Private key | **NEVER** |
| `~/.ssh/id_ed25519.pub` | Public key | Goes on the Pi |

Copy the public key to your clipboard:

```bash
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output (starts with `ssh-ed25519 ...`).

### Step 3: Flash Raspberry Pi OS Lite (64-bit)

1. Insert the spare microSD card into your laptop.
2. Open Raspberry Pi Imager.
3. Configure:
   - **Device:** Raspberry Pi 5
   - **Operating System:** Raspberry Pi OS Lite (64-bit) — under *Raspberry Pi OS (other)*

   **Why Lite?** No desktop = less software = smaller attack surface. This Pi is a headless server controlled via SSH.

   **Why 64-bit?** OpenClaw and Node.js require it.

4. Click the **settings/gear icon** and configure:

   | Setting | Value | Notes |
   |---|---|---|
   | Hostname | `<YOUR_HOSTNAME>` (e.g. `openclaw-pi`) | The Pi's network name |
   | Enable SSH | Yes — **Allow public-key authentication only** | Paste your public key from Step 2 |
   | Username | `<ADMIN_USER>` (e.g. `clawadmin`) | Avoid the default `pi` — attackers try it first |
   | Password | `<YOUR_PASSWORD>` | Strong password; needed for `sudo` commands |
   | Wi-Fi | Only if connecting wirelessly to your isolated network | If using Ethernet, skip |
   | Locale/Timezone | `<YOUR_TIMEZONE>` (e.g. `Europe/London`) | Important for log timestamps |
   | Raspberry Pi Connect | **Off** | See security note below |

   > ⚠️ **Security Note — Raspberry Pi Connect:** Leave this **off**. It creates an outbound tunnel through Raspberry Pi's cloud servers, bypassing your network isolation and adding a third-party trust dependency. Secure remote access will be configured later via Tailscale.

   > **Naming tip:** Choose different values for hostname and admin username. A dedicated `openclaw` user (unprivileged) will be created during hardening — if your admin username were also `openclaw`, you'd have a naming collision.

5. Click **Write** and wait for flashing to complete.

### Step 4: First boot

1. Insert the microSD card into the Pi (slot on the underside).
2. Connect the Pi to your isolated network via Ethernet (or rely on Wi-Fi from Step 3).
3. Plug in the 27 W USB-C power supply. The Pi boots automatically.
4. Wait 60–90 seconds for first boot to complete.

### Step 5: Connect via SSH

**Important:** Your laptop must be on the **same network** as the Pi. If the Pi is on your isolated/guest network and your laptop is on the main network, temporarily connect your laptop to the isolated network.

```bash
ssh <ADMIN_USER>@<YOUR_HOSTNAME>.local
```

**Expected:** A host authenticity message — type `yes`. Then a prompt like:

```
clawadmin@openclaw-pi:~ $
```

**If the hostname doesn't resolve**, find the Pi's IP from your router's admin page and connect directly:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

### Step 6: Verify the OS

```bash
uname -m
```

Expected: `aarch64`

```bash
hostname
```

Expected: your chosen hostname.

### Step 7: Update all packages

```bash
sudo apt update && sudo apt full-upgrade -y
```

| Component | Meaning |
|---|---|
| `sudo` | Run with administrator privileges |
| `apt update` | Refresh the list of available updates |
| `apt full-upgrade -y` | Install all updates without prompting |

> **Note:** `sudo` may not prompt for a password — Raspberry Pi OS
> configures passwordless sudo for the initial user by default. On this
> single-user, network-isolated Pi where only you have SSH access, this
> is acceptable. The `openclaw` user created later has no sudo access
> at all — that is the primary security boundary.

Takes 5–10 minutes. Then reboot:

```bash
sudo reboot
```

Wait ~30 seconds, reconnect:

```bash
ssh <ADMIN_USER>@<YOUR_HOSTNAME>.local
```

---

## Part B — Migrate to the NVMe SSD

### Step 8: Verify the Pi sees the NVMe drive

```bash
lsblk
```

You should see `mmcblk0` (microSD) and `nvme0n1` (NVMe SSD). If `nvme0n1` is missing, power off, reseat the SSD, try again.

### Step 9: Copy the OS to the NVMe

```bash
sudo dd if=/dev/mmcblk0 of=/dev/nvme0n1 bs=4M status=progress
```

**Do not interrupt this or close the terminal.** Duration depends on microSD size (a 128 GB card at ~96 MB/s ≈ 22 minutes).

**Completion indicator:** Your command prompt returns after a records in/out summary.

**To verify it's still running** (without interrupting): open a second terminal, SSH in, run:

```bash
ps aux | grep dd
```

**If SSH drops during copy:** Reconnect, run `lsblk`. If `nvme0n1` shows partitions matching the microSD layout, the copy completed. If not, re-run `dd` — the source was read-only, nothing is lost.

### Step 10: Set boot order to NVMe

```bash
sudo raspi-config
```

Navigate to: **Advanced Options → Boot Order → NVMe/USB Boot**

### Step 11: Expand the NVMe partition

Still in `raspi-config`: **Advanced Options → Expand Filesystem**, then exit (do **not** reboot yet).

Now expand manually (required — `raspi-config` alone may not fully expand the NVMe):

```bash
sudo parted /dev/nvme0n1 resizepart 2 100%
```

Type `Yes` if prompted.

```bash
sudo resize2fs /dev/nvme0n1p2
```

> **Note:** In some cases, `raspi-config` "Expand Filesystem" alone does not expand the NVMe partition. The explicit `parted` + `resize2fs` commands above are included for reliability.

### Step 12: Reboot and verify

```bash
sudo reboot
```

Reconnect, then verify:

```bash
findmnt /
```

Expected: SOURCE shows `/dev/nvme0n1p2`.

```bash
df -h /
```

Expected: Size ≈ 938–940 GB.

### Step 13: Remove the microSD card

1. `sudo poweroff`
2. Wait for the green LED to stop flickering (steady red = shut down).
3. Unplug the power cable.
4. Remove the microSD card.
5. Plug the power back in.
6. Wait ~60 seconds, reconnect via SSH to confirm NVMe-only boot works.

**Keep the microSD card** — label it (e.g. "OpenClaw Pi Recovery — `<DATE>`") and store safely. It's your emergency recovery device.

---

## Part C — OS Hardening

OS hardening is covered in **Phase 2b**. Proceed directly to Phase 2b now.

---

## Verification Checklist

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Running from NVMe | `findmnt /` | Source: `/dev/nvme0n1p2` |
| 2 | Full disk available | `df -h /` | Size ≈ 939 GB |
| 3 | 64-bit OS | `uname -m` | `aarch64` |
| 4 | System up to date | `sudo apt update && sudo apt full-upgrade` | `0 upgraded` |
| 5 | MicroSD removed | Physical check | Card labelled and stored |

---

## Troubleshooting

### SSH hangs or "cannot resolve host"

**Cause:** Laptop and Pi are on different networks. mDNS (`.local`) only works within the same segment.
**Fix:** Temporarily connect your laptop to the Pi's isolated network. Tailscale (later phase) eliminates this.

### SSH drops during `dd` copy

**Cause:** SSH idle timeout during long copy, especially on Wi-Fi with packet loss.
**Fix:** Reconnect, run `lsblk`. Matching partitions on `nvme0n1` = copy completed. Otherwise re-run `dd`.

### NVMe shows original microSD size after migration

**Cause:** `raspi-config` Expand Filesystem may not apply to NVMe when booted from microSD.
**Fix:** `sudo parted /dev/nvme0n1 resizepart 2 100%` then `sudo resize2fs /dev/nvme0n1p2`.

### Pi won't boot after removing microSD

**Cause:** Boot order not saved.
**Fix:** Re-insert microSD, boot, re-run `sudo raspi-config` → Advanced Options → Boot Order → NVMe/USB Boot.


# Phase 2b — Raspberry Pi OS Hardening

Locks down a fresh Raspberry Pi OS Lite (64-bit, Bookworm) installation with eight security hardening steps, preparing it as an isolated host for OpenClaw.

---

## Prerequisites

Before starting this phase, you should have already completed:

- **Phase 0 — Concepts & Context:** You understand what OpenClaw is, what a Raspberry Pi is, and why network isolation and "assume breach" matter.
- **Phase 1 — Network Preparation:** The Pi is connected to a network-isolated segment (VLAN, guest network with AP isolation, or dedicated router). It **cannot** communicate with personal devices on your main network.
- **Phase 2 (earlier steps):**
  - Raspberry Pi OS Lite (64-bit, Bookworm) flashed to a microSD card via Raspberry Pi Imager.
  - Headless setup configured during flashing: hostname, SSH enabled with public key authentication, network connection, locale.
  - Argon NEO 5 NVMe case assembled with the 1 TB NVMe SSD mounted.
  - OS successfully migrated from the microSD to the NVMe SSD.
  - Pi boots from the NVMe and responds to ping. The microSD card has been removed.
  - You can SSH into the Pi from your laptop.

---

## Step 1 — Update All Packages

Ensures you start from the most secure baseline by installing all available patches.

```bash
sudo apt update && sudo apt full-upgrade -y
```

- `sudo` — runs the command with administrator privileges.
- `apt update` — downloads the latest list of available software and security patches (does not install anything).
- `&&` — runs the next command only if the first succeeds.
- `apt full-upgrade -y` — installs all available updates. `-y` auto-confirms.

**Expected output:** Scrolling text as packages are downloaded and installed. Takes a few minutes. You return to the normal command prompt when complete.

If the system asks you to reboot:

```bash
sudo reboot
```

Wait ~30 seconds, then SSH back in.

---

## Step 2 — Lock Down SSH (Key-Only Access)

Disables password-based login so that only your specific SSH key can authenticate. Prevents brute-force password guessing attacks.

### 2.1 — Verify your SSH key is in place

```bash
cat ~/.ssh/authorized_keys
```

**Expected output:** A long string starting with `ssh-ed25519` or `ssh-rsa` followed by a block of characters. This is your public key.

> ⚠️ **Stop if the file is empty or you get "No such file."** Your key is not installed. Fix this before proceeding or you will be locked out.

### 2.2 — Back up the SSH configuration

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
```

Creates a safety copy of the original config in case something goes wrong.

### 2.3 — Edit the SSH configuration

```bash
sudo nano /etc/ssh/sshd_config
```

`nano` is a simple text editor in the terminal. Use `Ctrl+W` to search for each setting below. Remove the leading `#` (if present) and set the value as shown:

| Setting                        | Set to                              | Why                                                             |
|--------------------------------|-------------------------------------|-----------------------------------------------------------------|
| `PasswordAuthentication`       | `PasswordAuthentication no`         | Disables password login. Only SSH keys accepted.                |
| `KbdInteractiveAuthentication` | `KbdInteractiveAuthentication no`   | Disables a secondary password-based authentication method.      |
| `PermitRootLogin`              | `PermitRootLogin no`                | Blocks direct login as root (the unlimited superuser account).  |

Save and exit: `Ctrl+X` → `Y` → `Enter`.

### 2.4 — Restart the SSH service

```bash
sudo systemctl restart ssh
```

Applies the new configuration. Your current session stays connected.

### 2.5 — Test from a second terminal

> ⚠️ **Critical: Do NOT close your current SSH session yet.** It is your safety net.

Open a **new** terminal window on your laptop and SSH in:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

- **If you get in without being asked for a password** (you may be prompted for your SSH key passphrase — that's fine and expected; it protects the key file on your laptop) → success.
- **If you are asked for a password or see "Permission denied"** → something went wrong. Use your still-open first session to troubleshoot.

---

## Step 3 — Install and Configure the Firewall (UFW)

Blocks all incoming network connections except SSH from your specific laptop. Even on the isolated network, defense in depth adds layers.

### 3.1 — Install UFW

```bash
sudo apt install ufw -y
```

UFW = **U**ncomplicated **F**ire**w**all. May already be installed — that's fine.

### 3.2 — Set default rules

```bash
sudo ufw default deny incoming
```

Blocks **all** incoming connections by default.

```bash
sudo ufw default allow outgoing
```

Allows the Pi to reach the internet (for updates, API calls, etc.). Safe — controls only connections the Pi initiates.

### 3.3 — Allow SSH from your laptop only

First, find your laptop's IP address on the isolated network.

**macOS:**

```bash
ipconfig getifaddr en0
```

(If that returns nothing, try `ifconfig | grep "inet "` and look for the address on your active network interface.)

**Windows (PowerShell):**

```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' }).IPAddress
```

Then, on the Pi:

```bash
sudo ufw allow from <YOUR_LAPTOP_IP> to any port 22 proto tcp comment "SSH from my laptop"
```

- `allow from <YOUR_LAPTOP_IP>` — only this one IP is permitted.
- `to any port 22` — SSH's port.
- `proto tcp` — the protocol SSH uses.
- `comment "..."` — a human-readable note for future reference.

### 3.4 — Enable the firewall

```bash
sudo ufw enable
```

It will warn about disrupting SSH connections. Type `y` and press `Enter` (your SSH rule is already in place).

### 3.5 — Verify

```bash
sudo ufw status verbose
```

**Expected output:**

```
Status: active
Default: deny (incoming), allow (outgoing), disabled (routed)

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    <YOUR_LAPTOP_IP>        # SSH from my laptop
```

### 3.6 — Safety check

Open a **new** terminal and SSH in again. Confirm access still works before closing any existing sessions.

---

## Step 4 — Install fail2ban

Monitors login attempts and automatically bans IP addresses that fail too many times. An additional layer on top of the firewall.

### 4.1 — Install

```bash
sudo apt install fail2ban -y
```

### 4.2 — Create a local configuration

Never edit the default `jail.conf` — updates can overwrite it. Create a local override:

```bash
sudo nano /etc/fail2ban/jail.local
```

Paste the following:

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3

[sshd]
enabled = true
port = ssh
backend = systemd
```

| Setting      | Meaning                                              |
|-------------|-------------------------------------------------------|
| `bantime`   | Block offending IPs for 1 hour.                       |
| `findtime`  | Look at the last 10 minutes of login attempts.        |
| `maxretry`  | 3 failures within `findtime` triggers a ban.          |
| `backend`   | Tells fail2ban where to find logs on modern Pi OS.    |

Save and exit: `Ctrl+X` → `Y` → `Enter`.

### 4.3 — Start fail2ban and enable on boot

```bash
sudo systemctl enable fail2ban --now
```

`enable` = start on every boot. `--now` = also start immediately.

### 4.4 — Verify

```bash
sudo fail2ban-client status sshd
```

**Expected output:**

```
Status for the jail: sshd
|- Filter
|  |- Currently failed: 0
|  `- Total failed:     0
`- Actions
   |- Currently banned: 0
   `- Total banned:     0
```

All zeros is expected — nothing bad has happened yet.

---

## Step 5 — Create a Dedicated OpenClaw User

OpenClaw will run as an unprivileged user with no `sudo` access. This confines any damage (from a bug, prompt injection, or misconfiguration) to OpenClaw's own directory — it cannot modify system settings, read your personal files, or change security configurations.

### 5.1 — Create the user

```bash
sudo adduser --disabled-password openclaw
```

`--disabled-password` means no one can log into this account remotely via password. You switch into it from your admin account when needed.

It will prompt for "Full Name" and other optional fields. Press `Enter` through all of them.

Restrict the home directory permissions:

```bash
sudo chmod 750 /home/openclaw
```

The default home directory permission on Debian is `755` (world-readable). Since this directory will contain `.git-credentials` and other sensitive files, restricting it to `750` (owner + group only) reduces exposure. With no other users in the `openclaw` group, this effectively makes it owner-only while still allowing group-based access if needed later.

### 5.2 — Create the OpenClaw configuration directory

```bash
sudo mkdir -p /home/openclaw/.openclaw
```

### 5.3 — Set ownership and permissions

```bash
sudo chown -R openclaw:openclaw /home/openclaw/.openclaw
sudo chmod 700 /home/openclaw/.openclaw
```

- `chown -R openclaw:openclaw` — makes the `openclaw` user the owner of its own config folder.
- `chmod 700` — only the owner can read, write, or access this directory. All other users are blocked.

### 5.4 — Verify

```bash
id openclaw
```

**Expected output (example):**

```
uid=1001(openclaw) gid=1001(openclaw) groups=1001(openclaw)
```

Confirm there is **no** `sudo` or `admin` in the groups list.

Test switching into the account:

```bash
sudo su - openclaw
pwd
```

Should print `/home/openclaw`. Type `exit` to return to your admin account.

---

## Step 6 — Disable Unnecessary Services

Every running service is a potential attack surface. Turn off anything the Pi doesn't need.

### 6.1 — Disable Bluetooth

```bash
sudo systemctl disable bluetooth --now
```

Not needed for OpenClaw. Removes a wireless attack vector.

### 6.2 — Disable Avahi (network discovery / mDNS)

```bash
sudo systemctl disable avahi-daemon --now
```

Avahi broadcasts your Pi's presence on the network. Since you know the Pi's IP address, it doesn't need to advertise itself.

> ⚠️ **Important consequence:** Disabling Avahi means the `.local` hostname (e.g., `openclaw-pi.local`) will **stop working** for SSH. You must use the Pi's **IP address directly** from this point forward. Setting a static IP on your router (see [Step 9](#step-9--recommended-set-a-static-ip-on-your-router) below) is strongly recommended.

### 6.3 — Disable Triggerhappy

```bash
sudo systemctl disable triggerhappy --now
```

A hotkey/button daemon. Not needed in a headless (no keyboard/monitor) setup.

### 6.4 — (If using Ethernet) Disable Wi-Fi

If the Pi is connected to the isolated network via an **Ethernet cable**, disable the Wi-Fi radio entirely:

```bash
sudo nmcli radio wifi off
```

This removes the entire wireless attack surface. **Skip this if you are using Wi-Fi** to connect to your isolated network.

### 6.5 — Verify

```bash
sudo systemctl is-active bluetooth avahi-daemon triggerhappy
```

**Expected output:**

```
inactive
inactive
inactive
```

---

## Step 7 — Enable Automatic Security Updates

Configures the Pi to automatically download and install critical security patches daily, so it stays protected without manual intervention.

### 7.1 — Install unattended-upgrades

```bash
sudo apt install unattended-upgrades -y
```

### 7.2 — Enable automatic updates

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

Select **Yes** when prompted.

### 7.3 — Customize the configuration

```bash
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Find and set these three values (use `Ctrl+W` to search). Remove the leading `//` if present and set the value as shown:

| Setting                                          | Value    | Why                                                              |
|--------------------------------------------------|----------|------------------------------------------------------------------|
| `Unattended-Upgrade::Automatic-Reboot`           | `"true"` | Some patches (e.g., kernel) require a reboot to take effect.     |
| `Unattended-Upgrade::Automatic-Reboot-Time`      | `"04:00"`| Reboots at 4:00 AM to avoid disrupting daytime use.              |
| `Unattended-Upgrade::Remove-Unused-Dependencies` | `"true"` | Cleans up leftover packages after updates. Reduces attack surface.|

Save and exit: `Ctrl+X` → `Y` → `Enter`.

### 7.4 — Test with a dry run

```bash
sudo unattended-upgrades --dry-run --debug
```

This simulates an update run without installing anything. Expect lots of output. If all packages are already up to date (from Step 1), you will see:

```
No packages found that can be upgraded unattended and no pending auto-removals
...
upgrade result: True
```

This is normal. The key indicator is `upgrade result: True` — the process completed successfully.

### 7.5 — Verify it's enabled

```bash
sudo systemctl is-enabled unattended-upgrades
```

**Expected output:** `enabled`

---

## Step 8 — Verify Swap (zram)

Raspberry Pi OS Bookworm comes with **zram swap pre-configured**. zram creates compressed swap space in RAM itself, providing a memory overflow safety net without wearing out your SSD.

> ⚠️ **Do NOT install the `zram-tools` package.** It conflicts with the built-in zram configuration on Raspberry Pi OS Bookworm and causes service failures ("Device or resource busy" errors). The built-in configuration is sufficient.

### 8.1 — Verify zram is active

```bash
free -h
```

**Expected output (look at the Swap row):**

```
               total        used        free      shared  buff/cache   available
Mem:            15Gi       565Mi        14Gi        13Mi       467Mi        15Gi
Swap:          2.0Gi          0B       2.0Gi
```

```bash
zramctl
```

**Expected output:**

```
NAME       ALGORITHM DISKSIZE DATA COMPR TOTAL STREAMS MOUNTPOINT
/dev/zram0 zstd            2G  16K   69B   48K       4 [SWAP]
```

Confirm you see a zram device using `zstd` compression, mounted as `[SWAP]`. 2 GB of compressed zram on top of 16 GB of RAM is sufficient for running Ollama and OpenClaw.

---

## Step 9 — (Recommended) Set a Static IP on Your Router

Since Avahi is now disabled (Step 6), you must use the Pi's IP address to SSH in. By default, the router assigns IPs dynamically (via DHCP), so the address could change. A static reservation ensures the Pi always gets the same IP.

### 9.1 — Get the Pi's MAC address

On the Pi, run:

**If connected via Ethernet:**

```bash
ip link show eth0 | grep ether
```

**If connected via Wi-Fi:**

```bash
ip link show wlan0 | grep ether
```

Note the value after `link/ether` (format: `aa:bb:cc:dd:ee:ff`). This is the Pi's MAC address — a unique hardware identifier.

### 9.2 — Create the reservation on your router

The exact steps depend on your router model. The general process is:

1. Log into your router's admin panel (typically `http://192.168.8.1` for GL.iNet routers — or the gateway IP for your specific router model).
2. Navigate to **LAN** settings (on GL.iNet: **NETWORK → LAN**).
3. Find the **Address Reservation** (or **DHCP Reservation**) section.
4. Add a new entry:
   - **MAC Address:** `<YOUR_MAC_ADDRESS>` (from step 9.1)
   - **IP Address:** `<RASPBERRY_PI_IP>` (the current working IP)
5. Save/Apply.

### 9.3 — Apply the reservation

```bash
sudo reboot
```

Wait ~30 seconds, then SSH in using the reserved IP:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

---

## Verification Checklist

After completing all steps, confirm:

- [ ] All OS packages are up to date (`sudo apt update` shows no upgradable packages)
- [ ] SSH rejects password login (only key + passphrase accepted)
- [ ] Root login via SSH is disabled
- [ ] UFW is active, default deny incoming, SSH allowed only from your laptop's IP (`sudo ufw status verbose`)
- [ ] fail2ban is running and monitoring SSH (`sudo fail2ban-client status sshd`)
- [ ] `openclaw` user exists with no sudo/admin group membership (`id openclaw`)
- [ ] `~/.openclaw` directory is owned by `openclaw` with `700` permissions
- [ ] Bluetooth, Avahi, and Triggerhappy are inactive (`sudo systemctl is-active bluetooth avahi-daemon triggerhappy`)
- [ ] Automatic security updates are enabled (`sudo systemctl is-enabled unattended-upgrades`)
- [ ] zram swap is active (~2 GB, zstd compression) (`free -h` and `zramctl`)
- [ ] You can SSH in using the Pi's IP address from a fresh terminal session

---

## Troubleshooting

### SSH hangs when using `.local` hostname after reboot

**Cause:** Avahi (mDNS) was disabled in Step 6. The `.local` hostname no longer resolves.

**Fix:** Use the Pi's IP address directly instead of the `.local` hostname:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

Set a static IP reservation on your router (Step 9) so the address never changes.

### zram service fails with "Device or resource busy"

**Cause:** The `zram-tools` package was installed and conflicts with Pi OS Bookworm's built-in zram configuration.

**Fix:** Remove `zram-tools` and rely on the built-in setup:

```bash
sudo apt remove zram-tools -y
sudo reboot
```

After reboot, verify with `free -h` and `zramctl`. You should see ~2 GB of swap on a zstd-compressed zram device.

### SSH works by IP but not by hostname (even before disabling Avahi)

If mDNS resolution is slow or unreliable after a reboot, the SSH client may time out waiting for the hostname to resolve while `ping` (which has a longer timeout) eventually succeeds.

**Fix:** Always use the IP address. Set a static IP reservation so you have a reliable, memorable address.

### Locked out of SSH after changing the config

If you still have a session open, use it to restore the backup:

```bash
sudo cp /etc/ssh/sshd_config.backup /etc/ssh/sshd_config
sudo systemctl restart ssh
```

If all sessions are closed, connect a USB keyboard and HDMI monitor (micro-HDMI on the Pi 5) directly to the Pi. You will get a text-based login prompt (no GUI needed). Log in with your username and password, then restore the SSH config as above.


# Phase 3 — Ollama Installation & Local Model Setup

Install [Ollama](https://ollama.ai) on the Raspberry Pi 5 and download small, efficient local models to serve as free, private fallbacks for lightweight tasks. Claude (via the Anthropic API) remains the primary model for all heavy reasoning and tool-enabled work.

---

## Prerequisites

Before starting this phase, confirm that:

- **Phase 1 (Network Isolation)** is complete — the Pi is on an isolated network segment.
- **Phase 2 (OS Installation & Hardening)** is complete — Raspberry Pi OS Lite (64-bit) is running on the NVMe SSD, SSH is key-only, UFW is active, and `fail2ban` is installed.
- You can SSH into the Pi from your personal computer.

---

## Steps

### 1. SSH into the Raspberry Pi

From your personal computer's terminal, connect to the Pi:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

Replace `<ADMIN_USER>` with the admin username you chose during OS flashing (e.g., `clawadmin`), and `<RASPBERRY_PI_IP>` with the static IP you reserved in Phase 2b, Step 9.

---

### 2. Install Ollama

Run the official Ollama installation script:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**What this does:** Downloads and runs Ollama's installer, which installs the `ollama` binary to `/usr/local/bin`, creates a dedicated `ollama` system user, and sets up a `systemd` service so Ollama starts automatically on boot.

**Expected output:** The script prints progress lines ending with:

```
>>> Enabling and starting ollama service...
>>> Installation complete.
```

---

### 3. Verify the installation

Check that the Ollama binary is available:

```bash
ollama --version
```

**Expected output:** A version string such as `ollama version 0.x.x`.

Then confirm the background service is running:

```bash
sudo systemctl status ollama
```

**Expected output:** You should see `active (running)` highlighted in green. Press `q` to exit the status view.

---

### 4. Increase the default context window

Ollama defaults to a 4,096-token context window for all models, which is quite small. Increasing it to 8,192 gives models more "working memory" per conversation, which matters for OpenClaw interactions.

Open a systemd override file:

```bash
sudo systemctl edit ollama
```

This opens a text editor. Between the comment markers, add these two lines:

```ini
[Service]
Environment="OLLAMA_CONTEXT_LENGTH=8192"
```

Save and exit the editor (in `nano`: `Ctrl+O`, `Enter`, `Ctrl+X`).

Then reload the systemd configuration and restart Ollama:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Verify Ollama is still running after the restart:

```bash
sudo systemctl status ollama
```

> ⚠️ **Performance Note:** A larger context window uses more RAM per loaded model. On a 16 GB Pi, 8,192 tokens is a safe increase. Going much higher (e.g., 32,768) with an 8B model may cause memory pressure when OpenClaw and Docker are also running.

---

### 5. Download local models

Download three models, each serving a different purpose. Run each command and wait for it to complete before starting the next.

**Small and fast (recommended starting model):**

```bash
ollama pull qwen3:1.7b
```

Download size: ~1–2 GB. This 1.7-billion-parameter model is the best balance of speed and quality for the Pi. Expect ~5–10 tokens/second. Good for quick tasks and fast fallback.

**Smarter but slower (for when quality matters more than speed):**

```bash
ollama pull qwen3:8b
```

Download size: ~5 GB. Uses ~5–6 GB of RAM when loaded. Expect ~1–3 tokens/second on the Pi 5 — noticeably slower, but higher quality output. Qwen3 8B is recommended at this size class because it has strong tool-calling capability, which is how OpenClaw communicates with models.

**Minimal and fastest (for the simplest tasks):**

```bash
ollama pull gemma3:1b
```

Download size: <1 GB. Google's Gemma 3 at 1 billion parameters — the smallest practical option with the highest token throughput on the Pi 5.

> **How Ollama manages memory:** Only one model is loaded into RAM at a time. When OpenClaw (or you) request a different model, Ollama unloads the current one and loads the new one. You don't need to worry about all three consuming RAM simultaneously.

---

### 6. Verify installed models

```bash
ollama list
```

**Expected output:** A table listing all three models with their names, sizes, and modification dates:

```
NAME           ID            SIZE    MODIFIED
gemma3:1b      ...           ...     ...
qwen3:1.7b     ...           ...     ...
qwen3:8b       ...           ...     ...
```

---

### 7. Test a model interactively

Send a simple question to verify a model works end-to-end:

```bash
ollama run qwen3:1.7b "What is a Raspberry Pi?"
```

**What to expect:**

- A pause of ~5–15 seconds before text begins appearing.
- The response streams word by word.
- Some models display a thinking process first (between `<think>` tags), then the actual answer. This is normal.
- Quality will be noticeably lower than Claude — this is expected for a model this size.

Press `Ctrl+D` or type `/bye` to exit if it drops into interactive mode.

Optionally, test the 8B model to compare speed and quality:

```bash
ollama run qwen3:8b "Explain what an API key is in one paragraph."
```

This will be slower (30–60+ seconds for a full response) but the output quality should be better.

---

### 8. Verify the Ollama API endpoint

OpenClaw communicates with Ollama through its local HTTP API. Confirm it responds:

```bash
curl http://localhost:11434/api/tags
```

**Expected output:** A JSON response listing your installed models. If you see your model names in the output, the API is working correctly.

---

## Security Considerations

These are critical and will be enforced in Phase 4 (OpenClaw configuration):

- **Small models are more vulnerable to prompt injection.** The OpenClaw security documentation explicitly warns that less capable models are more easily tricked by malicious content (e.g., hidden instructions on a web page). Larger, more powerful models like Claude are significantly better at recognizing and resisting these attacks.

- **Local models must NOT be used for tool-enabled work.** Tools — running shell commands, reading/writing files, browsing the web — should only be handled by Claude. In Phase 4, we will configure OpenClaw so that when it falls back to a local model, dangerous tool access is restricted or disabled entirely.

- **Claude remains the primary model.** Local models serve as free, private fallbacks for simple tasks (quick questions, summarization, light orchestration) or as a safety net if the Anthropic API is unavailable. The heavy reasoning, coding, and research work goes to Claude.

---

## How OpenClaw Will Use These Models (Preview)

This configuration happens in Phase 4. Here is a conceptual preview so you understand the architecture:

```json5
// Simplified preview — do NOT configure this yet
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",   // Always tried first
        fallbacks: ["ollama/qwen3:8b", "ollama/gemma3:1b"]  // Backup list
      }
    }
  }
}
```

- **`primary`** — The model OpenClaw tries first for every request (Claude).
- **`fallbacks`** — A ranked backup list, tried in order only if the primary fails (API outage, billing limit reached, network issue).

OpenClaw does not automatically choose between local and cloud based on task difficulty. It always tries the primary model first. You can manually switch models mid-conversation using the `/model` slash command (e.g., `/model ollama/qwen3:8b`) to save on API costs for simple tasks.

Additionally, OpenClaw auto-discovers Ollama models when `OLLAMA_API_KEY` is set (any value works — Ollama doesn't require a real key). It queries the local API, detects models that report tool-calling support, and makes them available. This will be configured in Phase 4.

---

## Verification Checklist

Before proceeding to Phase 4, confirm each item:

- [ ] Ollama is installed (`ollama --version` returns a version number)
- [ ] The Ollama service is running (`sudo systemctl status ollama` shows `active (running)`)
- [ ] Context window is increased to 8192 (`sudo systemctl cat ollama` shows the override)
- [ ] Three models are downloaded (`ollama list` shows `qwen3:1.7b`, `qwen3:8b`, and `gemma3:1b`)
- [ ] At least one model produces a response (`ollama run qwen3:1.7b "test"` returns text)
- [ ] The Ollama API responds (`curl http://localhost:11434/api/tags` returns JSON with model names)

---

## Troubleshooting

### Ollama service fails to start

```bash
sudo journalctl -u ollama --no-pager -n 50
```

Check the last 50 log lines for error messages. Common causes: port 11434 already in use, or insufficient permissions for the `ollama` user.

### Model download stalls or fails

Re-run the `ollama pull` command — it resumes where it left off. If your internet connection is slow, large models (like the 5 GB `qwen3:8b`) may take a while. This is normal.

### "Out of memory" or Pi becomes unresponsive when running 8B model

The 8B model is close to comfortable limits when OpenClaw and Docker are also running. If this happens:

1. Stop the model: press `Ctrl+C` in the terminal.
2. Consider using `qwen3:1.7b` as your primary local fallback instead.
3. The 8B model will be more practical once OpenClaw is idle (not running Docker sandboxes simultaneously).

### `curl` to the API returns "Connection refused"

Ensure Ollama is running:

```bash
sudo systemctl start ollama
```

Then re-test with `curl http://localhost:11434/api/tags`.

---

## Context: Local Models vs. Claude (Quick Reference)

| Attribute | Local (Ollama on Pi) | Cloud (Claude via API) |
|---|---|---|
| **Cost** | Free (runs on your hardware) | Pay-per-use (billing limits set in Anthropic Console) |
| **Privacy** | Nothing leaves the Pi | Requests sent to Anthropic's servers |
| **Speed on Pi 5** | 1–10 tokens/sec depending on model size | Near-instant (limited by network latency) |
| **Quality** | Basic — suitable for simple tasks | High — complex reasoning, coding, research |
| **Context window** | ~8,192 tokens (~6,000 words) | ~200,000 tokens (~150,000 words) |
| **Prompt injection resistance** | Low — small models are easily fooled | High — large models resist manipulation better |
| **Tool use (shell, files, browser)** | **Should NOT be enabled** | **Primary model for all tool-enabled work** |

---


# Phase 4 — OpenClaw Installation & Security Hardening

**What this phase accomplishes:** Install OpenClaw and all its dependencies on the Raspberry Pi, run the onboarding wizard, build the Docker sandbox, and harden the configuration to a security-first baseline. This is the most security-critical phase of the entire project.

---

## Prerequisites

Before starting Phase 4, you should have completed:

- **Phase 1 — Network Preparation:** The Raspberry Pi is connected to an isolated network segment (e.g., a GL.iNet router creating a separate subnet). Your laptop can SSH into the Pi on this isolated network.
- **Phase 2 — OS Installation & Hardening:** Raspberry Pi OS Lite (64-bit, Bookworm) is installed and booting from the NVMe SSD. The OS is hardened with UFW, fail2ban, SSH key-only access, and unattended-upgrades. A dedicated non-root user named `openclaw` exists for running the OpenClaw service.
- **Phase 3 — Ollama Installed:** Ollama is installed and operational (used later for lightweight local model tasks).
- **Anthropic API key:** You have created an Anthropic API key with a **spending limit** configured in the [Anthropic Console](https://console.anthropic.com). Store the key in a password manager — do **not** paste it into any chat or unencrypted file.
- **Static IP / DHCP reservation:** Your laptop has a stable IP on the isolated network (set via your router's admin panel or manually on the laptop), and your Pi's UFW rules allow SSH from that IP.

---

## Part A — Install System-Wide Dependencies

These steps run as your **admin user** (the account with `sudo` privileges — not the `openclaw` user).

### Step 1 — Install Node.js 22

OpenClaw requires Node.js ≥ 22.12.0. Older versions have known security vulnerabilities (CVE-2025-59466, CVE-2026-21636).

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

This downloads a setup script from NodeSource and configures the Pi's package list to include Node.js 22.

```bash
sudo apt install -y nodejs
```

Installs Node.js and npm (the Node Package Manager).

**Verify:**

```bash
node --version
```

Expected: `v22.x.x` (where x ≥ 12 for the minor version).

```bash
npm --version
```

Expected: a version number (e.g., `10.x.x` or `11.x.x`).

### Step 2 — Install Git

OpenClaw's npm installation process requires Git.

```bash
sudo apt install -y git
```

**Verify:**

```bash
git --version
```

Expected: `git version 2.x.x`.

### Step 3 — Install Docker

Docker is required for sandboxing — running OpenClaw's tool execution inside isolated containers.

```bash
sudo apt install -y docker.io
```

### Step 4 — Create Docker group and add the `openclaw` user

The Docker group may not exist automatically on some Debian installations.

```bash
sudo groupadd docker
sudo usermod -aG docker openclaw
```

The first command creates the `docker` group (harmless if it already exists). The second adds the `openclaw` user to that group so it can run Docker commands without root.

> **Note:** Group changes do not take effect until the user logs out and back in. We will verify this later when we SSH in as `openclaw`.

### Step 5 — Enable lingering for the `openclaw` user

Lingering allows the `openclaw` user's systemd services to run even when nobody is logged in as that user — essential for an always-on assistant.

```bash
sudo loginctl enable-linger openclaw
```

**Verify:**

```bash
loginctl show-user openclaw --property=Linger
```

Expected: `Linger=yes`.

### Step 6 — Set up SSH access for the `openclaw` user

Copy your SSH public key to the `openclaw` account so you can log in directly via SSH (not via `sudo su -`, which doesn't provide a full systemd user session).

```bash
sudo mkdir -p /home/openclaw/.ssh
sudo cp /home/<ADMIN_USER>/.ssh/authorized_keys /home/openclaw/.ssh/authorized_keys
sudo chown -R openclaw:openclaw /home/openclaw/.ssh
sudo chmod 700 /home/openclaw/.ssh
sudo chmod 600 /home/openclaw/.ssh/authorized_keys
```

Replace `<ADMIN_USER>` with your admin account's username.

---

## Part B — Install OpenClaw (as the `openclaw` user)

From your laptop, open a **new** SSH session and log in directly as the `openclaw` user:

```bash
ssh openclaw@<RASPBERRY_PI_IP>
```

> ⚠️ **Important:** Always SSH in directly as `openclaw` rather than using `sudo su - openclaw`. The `sudo su` approach does not start a full systemd user session, which causes the gateway daemon installation to fail.

### Step 7 — Verify Docker access

```bash
groups
```

Expected: you should see `docker` in the list. Then:

```bash
docker run hello-world
```

Expected: a message saying "Hello from Docker!" — confirms Docker is working for this user.

### Step 8 — Configure npm global path

By default, npm global installs require `sudo`. This redirects them to a user-local directory instead, which is a security best practice (never run npm as root).

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Step 9 — Install OpenClaw

```bash
npm install -g openclaw@latest
```

This downloads and installs the latest stable OpenClaw release. It may take several minutes on the Pi.

**Verify:**

```bash
openclaw --version
```

Expected: a version string like `2026.2.x`.

---

## Part C — Run the Onboarding Wizard

### Step 10 — Launch the wizard

```bash
openclaw onboard --install-daemon
```

The `--install-daemon` flag tells the wizard to also set up a systemd user service that keeps OpenClaw running in the background.

### Step 11 — Wizard prompts

Select the following options at each prompt:

| Prompt | Selection | Why |
|---|---|---|
| Understand this is powerful and risky? | **Yes** | Acknowledge the risks of running an autonomous AI agent. |
| Onboarding mode | **Manual** | Gives full control over every setting. |
| What do you want to set up? | **Local gateway (this machine)** | The gateway runs on this Pi. |
| Workspace directory | Accept the default: `/home/openclaw/.openclaw/workspace` | Keeps everything under the dedicated user's home. |
| Model/auth provider | **Anthropic** | We're using Claude as the primary model. |
| Anthropic auth method | **Anthropic API key** | Simpler and more reliable on a headless Pi than OAuth. |
| Enter Anthropic API key | Paste your key directly into the terminal | Never paste API keys into chats or unencrypted notes. |
| Default model | **Keep current** (default: `anthropic/claude-opus-4-6`) | The strongest model is most resistant to prompt injection. |
| Gateway port | **18789** (default) | Standard port; safe since we're binding to localhost. |
| Gateway bind | **Loopback (127.0.0.1)** | Only programs on the Pi itself can reach the gateway. Nothing on the network can connect. |
| Gateway auth | **Token** | Requires a secret token to connect — extra protection layer. |
| Tailscale exposure | **Off** | No external exposure. We start locked down. |
| Gateway token | **Leave blank, press Enter** | Auto-generates a strong random token. |
| Channels | **Skip** | We'll set this up carefully in Phase 5. |
| Skills | **Skip** | We'll vet skills individually later (supply chain risk). |
| Hooks | **Skip for now** | If the wizard requires at least one selection, choose **session-memory** (a safe, built-in feature that saves conversation context). |
| Bash completion | **Yes** | Convenience only — lets you Tab-complete OpenClaw commands. |
| Daemon/systemd | **Yes** | Installs the background service. |

> ⚠️ **API Key Safety:** Never paste your API key into a chat interface, email, or shared document. If you accidentally expose a key, **revoke it immediately** in the [Anthropic Console](https://console.anthropic.com) and generate a new one.

> **Note:** The wizard may prompt for additional options in newer versions. If an unrecognized prompt appears, skip it or choose the most restrictive option and verify against https://docs.openclaw.ai/start/wizard

### Step 12 — Install the gateway daemon

If the wizard successfully installed the systemd service, skip to Step 13. If it reported that systemd user services were unavailable (this can happen), run:

```bash
openclaw gateway install
```

Expected output:

```
Installed systemd service: /home/openclaw/.config/systemd/user/openclaw-gateway.service
```

Verify the generated unit file uses the **full absolute path** to the `openclaw` binary:

```bash
cat ~/.config/systemd/user/openclaw-gateway.service | grep ExecStart
```

Expected output should show the full path, e.g.:

```
ExecStart=/home/openclaw/.npm-global/bin/openclaw gateway --port 18789
```

If `ExecStart` shows just `openclaw` (no path) or a wrong path:

```bash
# Find the correct path
which openclaw

# Edit the unit file
nano ~/.config/systemd/user/openclaw-gateway.service
```

Replace the `ExecStart` value with the full path from `which openclaw`, then reload:

```bash
systemctl --user daemon-reload
```

### Step 13 — Enable and start the gateway

```bash
systemctl --user enable --now openclaw-gateway
```

`enable` = start on boot. `--now` = also start it right now.

**Verify:**

```bash
systemctl --user status openclaw-gateway
```

Expected: `active (running)` shown in green.

---

## Part D — Build the Sandbox Docker Image

The sandbox is a Docker container where all of OpenClaw's tool execution runs in isolation. Without it, tools would run directly on the host Pi.

### Step 14 — Run the doctor check

```bash
openclaw doctor
```

When prompted to **create the OAuth directory** (`~/.openclaw/credentials`), select **Yes**.

When prompted to **build the sandbox image**, select **Yes**. If the build fails with an error about a missing `Dockerfile.sandbox` or `scripts/sandbox-setup.sh`, proceed to Step 15.

> **Why this fails:** When OpenClaw is installed via `npm` (rather than cloned from Git), the `scripts/` directory is not included in the package. This is a known gap.

### Step 15 — Build the sandbox image manually

Capture the UID of the `openclaw` user (the container user must match the host user for workspace bind-mount writes to succeed):

```bash
# Get the actual UID of the openclaw user
OPENCLAW_UID=$(id -u)
echo "Your openclaw user UID is: $OPENCLAW_UID"
```

> **Important — remember this number.** Every Docker configuration in this
> guide uses your `openclaw` user's UID to ensure the container user and
> host user match. Wherever you see `<OPENCLAW_UID>` in a config file,
> substitute this number (e.g., `1001`). If the UIDs don't match, you will
> hit "permission denied" errors on bind-mounted files (rclone credentials,
> workspace files, etc.).

Create the Dockerfile:

```bash
cat > /tmp/Dockerfile.sandbox << EOF
FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      bash coreutils curl git jq ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    useradd -m -s /bin/bash -u ${OPENCLAW_UID} claw
WORKDIR /workspace
USER claw
EOF
```

> **Note:** This intentionally uses `EOF` without quotes (not `'EOF'`) so the shell substitutes `${OPENCLAW_UID}`.

This creates a Debian container with essential tools and Node.js 22 (required for web app prototyping — the primary use case), running as a non-root user (`claw`) whose UID matches the host `openclaw` user.

Build the image:

```bash
docker build -t openclaw-sandbox:bookworm-slim -f /tmp/Dockerfile.sandbox /tmp
```

This takes several minutes on the Pi.

**Verify:**

```bash
docker images | grep openclaw-sandbox
```

Expected: a line showing `openclaw-sandbox` with the tag `bookworm-slim`.

### Step 16 — Re-run doctor to confirm

```bash
openclaw doctor
```

The sandbox warning should be gone. Expected sections:

- **Security:** "No channel security warnings detected."
- **Skills status:** Shows eligible and missing counts (normal).
- **Plugins:** Shows loaded/disabled/errors (0 errors is good).

---

## Part E — Harden the Configuration

This is the most important part of the entire setup. We'll replace the default configuration with a security-hardened version.

### Step 17 — Back up the current config

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup
```

### Step 18 — Retrieve your gateway token

You'll need the auto-generated token from the wizard. In a **second SSH session** (or note it down before editing):

```bash
grep token ~/.openclaw/openclaw.json.backup
```

Copy the token value — you'll paste it into the hardened config below.

### Step 19 — Replace the config with the hardened version

First, note your `openclaw` user's UID (you'll need it for the config below):

```bash
id -u
```

This will output a number (e.g., `1001`). Use this value wherever you see `<OPENCLAW_UID>` below.

Open the config file in nano:

```bash
nano ~/.openclaw/openclaw.json
```

Delete all existing content and replace with the following. **You must replace `<YOUR_GATEWAY_TOKEN>` with your actual token from Step 18:**

```json
{
  "messages": {
    "ackReactionScope": "group-mentions"
  },

  "logging": {
    "level": "info",
    "redactSensitive": "tools"
  },

  "agents": {
    "defaults": {
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      },
      "compaction": {
        "mode": "safeguard"
      },
      "workspace": "/home/openclaw/.openclaw/workspace",
      "model": {
        "primary": "anthropic/claude-opus-4-6"
      },
      "heartbeat": {
        "every": "0m"
      },
      "sandbox": {
        "mode": "all",
        "scope": "session",
        "workspaceAccess": "rw",
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "network": "bridge",
          "readOnlyRoot": false,
          "user": "<OPENCLAW_UID>:<OPENCLAW_UID>"
        },
        "browser": {
          "enabled": false
        }
      }
    }
  },

  "tools": {
    "allow": [
      "exec",
      "process",
      "read",
      "write",
      "edit",
      "apply_patch",
      "group:sessions",
      "group:memory",
      "web_search",
      "web_fetch",
      "browser"
    ],
    "deny": [
      "canvas",
      "nodes",
      "cron",
      "gateway"
    ],
    "elevated": {
      "enabled": false
    }
  },

  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "<YOUR_GATEWAY_TOKEN>"
    },
    "port": 18789,
    "bind": "loopback",
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "nodes": {
      "denyCommands": [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "calendar.add",
        "contacts.add",
        "reminders.add"
      ]
    }
  },

  "auth": {
    "profiles": {
      "anthropic:default": {
        "provider": "anthropic",
        "mode": "api_key"
      }
    }
  },

  "wizard": {
    "lastRunAt": "<AUTOGENERATED_TIMESTAMP>",
    "lastRunVersion": "<AUTOGENERATED_VERSION>",
    "lastRunCommand": "onboard",
    "lastRunMode": "local"
  },
  "meta": {
    "lastTouchedVersion": "<AUTOGENERATED_VERSION>",
    "lastTouchedAt": "<AUTOGENERATED_TIMESTAMP>"
  }
}
```

> **Note:** The `wizard` and `meta` blocks are auto-generated by OpenClaw
> to record when the onboarding wizard last ran. **Do not modify them** —
> copy them exactly as shown (including the placeholder text). They will
> be overwritten automatically with real values the next time you run any
> wizard or configuration command.

Save and exit nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

#### What each hardening change does

| Setting | Value | Purpose |
|---|---|---|
| `logging.redactSensitive` | `"tools"` | Strips API keys and sensitive data from tool execution logs. |
| `agents.defaults.model.primary` | `"anthropic/claude-opus-4-6"` | Explicitly sets the strongest model. Stronger models are significantly harder to manipulate via prompt injection. |
| `agents.defaults.heartbeat.every` | `"0m"` | Disables periodic heartbeat check-ins. Saves API tokens when idle; OpenClaw only responds when you message it. |
| `agents.defaults.sandbox.mode` | `"all"` | **Every** tool execution runs inside an isolated Docker container — not on the host Pi. |
| `agents.defaults.sandbox.scope` | `"session"` | Each conversation gets its own container. One compromised session cannot affect another. |
| `agents.defaults.sandbox.workspaceAccess` | `"rw"` | The sandbox can read/write the workspace folder (required for coding tasks). |
| `agents.defaults.sandbox.docker.network` | `"bridge"` | Allows internet access inside the sandbox (needed for `npm install`, `pip install`, etc.). Uses Docker's default isolated network. |
| `agents.defaults.sandbox.docker.image` | `"openclaw-sandbox:bookworm-slim"` | Uses the custom sandbox image built in Step 15, which includes Node.js 22 and runs as a non-root user matching the host `openclaw` UID. |
| `agents.defaults.sandbox.browser.enabled` | `false` | The browser runs on the **host**, not inside Docker. Setting this to `false` is correct — it prevents the sandbox from trying to proxy browser commands through the container, which would break isolation. The browser tool itself is enabled separately at the host level (`browser.enabled: true`). |
| `tools.allow` | (explicit list) | Allowlist of permitted tools: shell commands, file I/O, sessions, memory, web search, web fetch, and browser. Only these tools are available — everything else is blocked. |
| `tools.deny` | (explicit list) | Blocklist as a second layer: canvas, node commands, cron, and gateway control are hard-blocked. |
| `tools.elevated.enabled` | `false` | Disables "elevated mode" — a feature that lets tool execution escape the sandbox. We never want this. |

### Step 20 — Disable Bonjour / mDNS discovery

mDNS broadcasts the Pi's presence on the network. We don't need this.

```bash
echo 'OPENCLAW_DISABLE_BONJOUR=1' >> ~/.openclaw/.env
```

Creates an environment file that OpenClaw reads on startup. This stops the gateway from advertising itself via mDNS.

```bash
chmod 600 ~/.openclaw/.env
```

> This file will later hold API keys (Brave Search, GitHub). Setting `600` ensures only the `openclaw` user can read it — matching the protection on `openclaw.json`.

### Step 21 — Enable the browser tool

The browser tool gives OpenClaw full Chromium browser control for research
tasks — visiting websites, reading JavaScript-rendered pages, and extracting
content that `web_fetch` (plain HTTP) cannot handle.

```bash
openclaw config set browser.enabled true --json
```

> ⚠️ **Security Note — The browser runs on the host, not in the sandbox.**
> Unlike `exec`, `read`, and `write` (which run inside Docker containers),
> the browser tool launches a Chromium process directly on the Pi. The
> OpenClaw sandboxing docs state this explicitly: enabling `browser` inside
> sandbox settings "breaks isolation."
>
> This makes the browser the highest-risk tool in your setup. It is the
> primary vector for the **Indirect Injection via Fetched Content** attack
> chain (rated **High** in OpenClaw's threat model): a website OpenClaw
> visits for research could contain hidden instructions → OpenClaw follows
> them → data is exfiltrated.
>
> **Mitigations already in place:**
> - Network isolation (the Pi is on a separate subnet — even if data is
>   exfiltrated, it cannot reach your personal devices)
> - DM allowlist (only you can instruct OpenClaw to browse)
> - Claude as the primary model (strongest prompt injection resistance)
> - `sandbox.browser.enabled: false` in the config (the browser runs on
>   the host with its own isolation, not inside the weaker Docker sandbox)
>
> **If you later decide you don't need JavaScript rendering for research:**
> Run `openclaw config set browser.enabled false --json` and remove
> `"browser"` from `tools.allow`. OpenClaw will still have `web_search`
> (Brave API) and `web_fetch` (plain HTTP + readability extraction).

### How OpenClaw's three web tools differ

| Tool | What it does | JavaScript? | Runs where | Risk level |
|---|---|---|---|---|
| `web_search` | Searches the web via Brave Search API. Returns titles, URLs, snippets. | No | Gateway process | Low — only returns search metadata |
| `web_fetch` | HTTP GET on a URL. Extracts readable text (HTML → markdown). | No | Gateway process | Medium — reads page content, but no JS execution |
| `browser` | Full Chromium automation. Can click, scroll, fill forms, execute JS, take screenshots. | Yes | **Host** (not sandbox) | **Higher** — interacts with live web pages that may contain adversarial content |

For most research tasks (literature reviews, reading articles, checking
competitor pages), `web_search` + `web_fetch` will handle 80–90% of
needs. The `browser` tool is needed when a site requires JavaScript to
render its content (single-page apps, dynamic dashboards, pages behind
cookie consent walls).

### Step 22 — Lock down file permissions

```bash
chmod 700 ~/.openclaw
chmod 700 ~/.openclaw/credentials
chmod 600 ~/.openclaw/openclaw.json
```

| Permission | Meaning |
|---|---|
| `700` on directories | Only the `openclaw` user can read, write, or list contents. No other user on the Pi can access them. |
| `600` on `openclaw.json` | Only the `openclaw` user can read or write the config file. This file contains your API key and gateway token. |

**Verify:**

```bash
ls -la ~/.openclaw/openclaw.json
```

Expected: `-rw-------` at the start of the line.

### Step 23 — Restart the gateway to apply all changes

```bash
systemctl --user restart openclaw-gateway
```

---

## Part F — Verify the Hardened Setup

### Step 24 — Run the security audit

```bash
openclaw security audit --deep
```

**Expected output:**

```
Summary: 0 critical · 1 warn · 1 info
```

The remaining items should be:

- **WARN — `gateway.trusted_proxies_missing`:** Safe to ignore. This only applies if you put a reverse proxy in front of OpenClaw. We are not doing that.
- **INFO — `summary.attack_surface`:** Should show:
  - `groups: open=0, allowlist=0`
  - `tools.elevated: disabled`
  - `hooks: disabled`
  - `browser control: disabled`

### Step 25 — Run the doctor

```bash
openclaw doctor
```

Expected: clean output with no critical or sandbox warnings.

### Step 26 — Check gateway status

```bash
openclaw status
```

Confirm:

- Gateway: running, bound to loopback
- Auth: token set
- Systemd: installed, enabled, running

---

## Verification Checklist

Before moving to Phase 5, confirm every item:

- [ ] `node --version` shows v22.12.0 or higher
- [ ] `git --version` returns a version
- [ ] `openclaw --version` returns a version
- [ ] `docker run hello-world` works (as the `openclaw` user)
- [ ] Logged in via direct SSH as the `openclaw` user (not root, not admin)
- [ ] Onboarding wizard completed with **manual** mode
- [ ] Systemd daemon installed, enabled, and running (`active (running)`)
- [ ] Sandbox Docker image built (`docker images | grep openclaw-sandbox`)
- [ ] Gateway bound to **loopback** (127.0.0.1)
- [ ] Gateway auth token set (auto-generated)
- [ ] Tailscale exposure is **off**
- [ ] Sandbox mode is `"all"` — every tool runs in Docker
- [ ] Tools restricted to an explicit allowlist
- [ ] Browser control **disabled**
- [ ] Elevated mode **disabled**
- [ ] Sensitive data redacted in logs
- [ ] Bonjour/mDNS broadcasting **disabled**
- [ ] File permissions: `~/.openclaw/` at 700, `openclaw.json` at 600, `credentials/` at 700
- [ ] Heartbeat disabled (0m) to prevent idle API usage
- [ ] Security audit: **0 critical** issues
- [ ] `openclaw doctor`: clean

---

## Troubleshooting

These are issues likely to affect others following this guide.

### `npm install -g openclaw@latest` fails with `ENOENT ... spawn git`

**Cause:** Git is not installed. OpenClaw's install process requires it.

**Fix:** `sudo apt install -y git` (as your admin user), then retry the npm install.

### `npm install -g openclaw@latest` fails with `EACCES`

**Cause:** npm's default global install directory requires root.

**Fix:** Configure a user-local global directory (see Step 8 above), then retry.

### `docker run hello-world` gives "permission denied"

**Cause:** The `openclaw` user is not in the `docker` group, or the group doesn't exist yet.

**Fix (as admin user):**

```bash
sudo groupadd docker           # Create the group if it doesn't exist
sudo usermod -aG docker openclaw
```

Then **log out and SSH back in** as `openclaw`. Verify with `groups` — `docker` should be listed.

### `openclaw gateway install` fails with "systemctl --user unavailable" / DBUS error

**Cause:** You switched to the `openclaw` user via `sudo su -` instead of logging in directly via SSH. The `sudo su` method doesn't start a full systemd user session.

**Fix:** Exit back to your admin user, then SSH in directly as `openclaw`:

```bash
ssh openclaw@<RASPBERRY_PI_IP>
```

Then retry `openclaw gateway install`.

### Sandbox image build fails with "Dockerfile.sandbox: no such file or directory"

**Cause:** The `scripts/sandbox-setup.sh` script expects files that are only present in a git clone of the OpenClaw repository. When installed via npm, these files are not included.

**Fix:** Build the image manually using the Dockerfile provided in Step 15 above.

### SSH to the Pi times out after network changes

**Cause:** Your laptop's IP on the isolated network changed, and the Pi's UFW firewall only allows SSH from the previously configured IP.

**Fix:** Connect a keyboard and monitor to the Pi, log in, and update the UFW rule:

```bash
sudo ufw status numbered                      # Find the old SSH rule number
sudo ufw delete <RULE_NUMBER>                  # Remove the old rule
sudo ufw allow from <YOUR_NEW_IP> to any port 22 proto tcp comment "Laptop on isolated network"
```

**Prevention:** Set a static IP for your laptop (either via the router's DHCP reservation or manually in your laptop's network settings for this specific network).

---

## Security Notes

### What the sandbox does and does not protect

The Docker sandbox provides **meaningful isolation** for tool execution (shell commands, file reads/writes, code execution). If a prompt injection tricks OpenClaw into running something malicious, the damage is contained within the disposable container.

However, per the [OpenClaw Sandboxing docs](https://docs.openclaw.ai/gateway/sandboxing): *"This is not a perfect security boundary, but when the model does something dumb, it materially limits filesystem and process access."*

The sandbox does **not** isolate:
- The gateway process itself (runs on the host)
- Tools explicitly configured to run on the host (we disabled `tools.elevated` to prevent this)
- Network traffic from the container (set to `bridge` for package downloads — the container can reach the internet)

### Why `sandbox.docker.network` is set to `"bridge"` and not `"none"`

The default sandbox network is `"none"` (no network access), which is more secure. However, coding tasks frequently require downloading dependencies (`npm install`, `pip install`, etc.). Setting `"bridge"` allows outbound internet access from within the container.

> ⚠️ **Security Note:** This means a compromised sandbox could make outbound network requests. For maximum isolation, change this to `"none"` and pre-install dependencies in a custom Docker image. For a coding assistant use case, `"bridge"` is a practical trade-off.

### Why elevated mode is disabled

The [OpenClaw docs](https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated) describe `tools.elevated` as *"an explicit escape hatch that runs exec on the host."* With elevated mode enabled, tool execution can bypass the sandbox entirely. We disable it because our entire security model depends on the sandbox containing any potentially harmful actions.

---

*Guide version: Phase 4, based on OpenClaw 2026.2.12. Always verify against the [official OpenClaw docs](https://docs.openclaw.ai) — the project is under active development and configuration options may change.*


# Phase 5 — Telegram Channel Setup & Local Model Configuration

This phase connects OpenClaw to Telegram so you can interact with your agent from your phone, and configures local Ollama models as fallbacks alongside the Anthropic Claude API. By the end, you will have a fully working, security-hardened messaging channel with strict allowlisting, plus local models registered for lightweight tasks.

---

## Prerequisites

Before starting this phase, confirm the following are complete:

- **Phase 1–2**: Raspberry Pi 5 running Raspberry Pi OS Lite (64-bit) on NVMe, hardened (UFW, fail2ban, SSH key-only, unattended-upgrades), on an isolated network segment.
- **Phase 3**: Ollama installed and running as a system service with models pulled (`ollama list` shows your models).
- **Phase 4**: OpenClaw installed under a dedicated `openclaw` user (no sudo privileges), Docker working, onboarding wizard completed, gateway bound to loopback, sandbox mode `"all"`, tool allowlist configured, security audit clean.
- **Systemd service**: The OpenClaw gateway is running as a **user-level** systemd service named `openclaw-gateway` under the `openclaw` user.

### Key service commands used throughout this guide

```bash
# Stop the gateway
systemctl --user stop openclaw-gateway

# Start the gateway
systemctl --user start openclaw-gateway

# Restart the gateway
systemctl --user restart openclaw-gateway

# Check status
systemctl --user status openclaw-gateway
```

> ⚠️ **Important:** Do NOT use `sudo` with these commands. The `openclaw` user does not have sudo privileges by design (least-privilege principle). The `--user` flag manages user-level services, which requires no elevated permissions.

> ⚠️ **Important:** The service is named `openclaw-gateway`, **not** `openclaw`. If you get `Unit openclaw.service could not be found`, verify the correct name with:
> ```bash
> systemctl --user list-units --type=service --all | grep -i claw
> ```

---

## Part A — Install Telegram & Create Your Account

### Step 1: Install the Telegram app

Download the official Telegram app on your phone:

- **iPhone**: App Store → search "Telegram" → publisher must be **Telegram FZ-LLC**
- **Android**: Google Play Store → search "Telegram" → publisher must be **Telegram FZ-LLC**

Verify the publisher name to avoid counterfeit apps.

### Step 2: Create your account

Open Telegram and follow the signup process. It will ask for your phone number and send an SMS verification code.

### Step 3: Enable two-factor authentication (2FA)

Navigate to **Settings → Privacy and Security → Two-Step Verification** and set a strong password.

This protects your Telegram account from being hijacked — which matters because your Telegram account will be the only one authorized to control OpenClaw.

---

## Part B — Create a Telegram Bot via BotFather

### Step 4: Open BotFather

In Telegram, tap the search bar and search for `@BotFather`. Look for the one with a **blue verified checkmark** ✓. The username must be exactly `@BotFather` — be careful of imposters.

Tap **Start** (or type `/start`).

### Step 5: Create the bot

Type:

```
/newbot
```

BotFather will ask for:

1. **Display name** — the name users see in chat. Example: `OpenClaw Assistant`
2. **Username** — must end in `bot` and be unique across Telegram. Example: `myopenclaw_bot`

If the username is taken, try adding numbers (e.g., `myopenclaw2026_bot`).

### Step 6: Save the bot token

BotFather will reply with your **bot token**. It looks like:

```
7123456789:AAF1xR-some-long-string-here
```

**Copy this token immediately and save it in a password manager.** This token is a master key to your bot — anyone who has it can impersonate the bot and read its messages. Never share it, never commit it to version control.

### Step 7: Disable group joining

Type:

```
/setjoingroups
```

Select your bot, then choose **Disable**. This prevents anyone from adding your bot to group chats, reducing your attack surface.

---

## Part C — Configure OpenClaw for Telegram

### Step 8: Stop the gateway

SSH into your Pi as the `openclaw` user and stop the gateway so it doesn't pick up a half-written config:

```bash
systemctl --user stop openclaw-gateway
```

### Step 9: Edit the OpenClaw configuration

```bash
nano ~/.openclaw/openclaw.json
```

You need to add two things: a `channels` section and enable the Telegram plugin.

#### 9a: Add the `channels.telegram` block

Add a `channels` section at the top level of the JSON (e.g., after the `gateway` block). Place it at any top-level position with correct comma separation:

```json
"channels": {
    "telegram": {
        "enabled": true,
        "botToken": "<YOUR_BOT_TOKEN>",
        "dmPolicy": "allowlist",
        "allowFrom": [],
        "groupPolicy": "disabled"
    }
}
```

Replace `<YOUR_BOT_TOKEN>` with the actual token from BotFather.

Configuration explained:

| Key | Value | Purpose |
|-----|-------|---------|
| `enabled` | `true` | Turns on the Telegram channel. |
| `botToken` | `"<YOUR_BOT_TOKEN>"` | Authenticates OpenClaw as your bot. |
| `dmPolicy` | `"allowlist"` | **Only** user IDs listed in `allowFrom` can message the bot. Everyone else is silently ignored. This is stricter than the default `"pairing"` mode. |
| `allowFrom` | `[]` | Empty for now — we add your user ID in Step 13. |
| `groupPolicy` | `"disabled"` | Completely disables group chat. Defense-in-depth alongside the BotFather group-join disable. |

#### 9b: Enable the Telegram plugin

Telegram is delivered as a bundled plugin in OpenClaw. If you skipped channel setup during the onboarding wizard, the plugin is **disabled by default**. Look for or add a `plugins` section at the top level:

```json
"plugins": {
    "entries": {
        "telegram": {
            "enabled": true
        }
    }
}
```

If a `plugins.entries.telegram` block already exists with `"enabled": false`, change it to `true`.

> ⚠️ **Critical:** If you skip this step, the gateway will start but Telegram will never connect. The channels config alone is not enough — the plugin that powers the Telegram connection must also be enabled.

### Step 10: Validate the JSON and restart

Save the file (`Ctrl+O`, `Enter`, `Ctrl+X` in nano), then validate:

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null
```

- **No output** = valid JSON
- **Error with line number** = fix the syntax error (usually a missing comma or mismatched brace)

Start the gateway:

```bash
systemctl --user start openclaw-gateway
```

### Step 11: Verify Telegram is connected

```bash
openclaw channels status
```

Expected output should include a line like:

```
- Telegram default: enabled, configured, running, mode:polling, token:config
```

If Telegram does not appear at all, check:

1. The `plugins.entries.telegram.enabled` is `true` (see Step 9b)
2. The JSON is valid (re-run the validation command)
3. The bot token is correctly pasted (no extra spaces or missing characters)

### Step 12: Retrieve your Telegram user ID

Your user ID is a numeric identifier (e.g., `987654321`) that uniquely identifies your Telegram account. You need it for the allowlist.

The gateway is running in **polling mode** — it continuously fetches new messages from Telegram and consumes them. This means if you send a message while the gateway is running, the gateway grabs it before any other tool can see it. To retrieve your user ID, you must stop the gateway first.

Stop the gateway:

```bash
systemctl --user stop openclaw-gateway
```

Send any message to your bot on Telegram (e.g., "test"). The message will show a single checkmark (delivered to Telegram's servers but not yet read by the bot).

On the Pi, query Telegram's API directly:

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates" | python3 -m json.tool | grep -A2 '"from"'
```

Replace `<YOUR_BOT_TOKEN>` with your actual token (keep the word `bot` prefix — e.g., `bot7123456789:AAF1xR-...`).

Expected output:

```json
"from": {
    "id": 987654321,
    "is_bot": false,
```

The `id` value is your Telegram user ID. Write it down.

**Immediately clear your terminal history** (the command above contains your bot token):

```bash
history -c
```

### Step 13: Add your user ID to the allowlist

Edit the config:

```bash
nano ~/.openclaw/openclaw.json
```

Find the `allowFrom` line and add your numeric user ID as a string:

```json
"allowFrom": ["<YOUR_TELEGRAM_USER_ID>"]
```

For example: `"allowFrom": ["987654321"]`

Save and validate:

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null
```

### Step 14: Start the gateway and test

```bash
systemctl --user start openclaw-gateway
```

Send a message to your bot on Telegram. OpenClaw should now process and reply to your message.

If this is the first time OpenClaw has received a message, it will run its **bootstrap ritual** — an introductory conversation where it asks your name and how you'd like to use it. This is normal.

### Step 15: Run security checks

```bash
openclaw security audit --deep
```

Expected: **0 critical issues**. You may see one warning:

```
WARN  gateway.trusted_proxies_missing  Reverse proxy headers are not trusted
```

This warning is safe to ignore — it applies only if you were using a reverse proxy in front of the gateway, which you are not.

```bash
openclaw doctor
```

Expected output should include: `Telegram: ok (@<your_bot_username>)`

---

## Part D — Configure Ollama Local Models (Explicit Provider)

This section registers your local Ollama models in OpenClaw using explicit configuration. On the Raspberry Pi 5, Ollama's auto-discovery feature may time out during the `/api/show` introspection calls, so explicit configuration is more reliable and gives you precise control over which models are available.

### Step 16: Verify Ollama is running

First, confirm the Ollama system service is active:

```bash
systemctl status ollama --no-pager
```

**Expected:** `active (running)` shown in the output. If it shows `inactive` or `failed`, **switch to your admin user session** to restart it:

> ```bash
> # From a separate terminal, SSH in as your admin user:
> ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
> sudo systemctl restart ollama
> ```
>
> Then return to your `openclaw` user session for the remaining steps.

Then verify the API responds:

```bash
curl -s http://127.0.0.1:11434/api/tags | python3 -m json.tool | head -20
```

### Step 17: Stop the gateway

```bash
systemctl --user stop openclaw-gateway
```

### Step 18: Add the explicit model provider configuration

```bash
nano ~/.openclaw/openclaw.json
```

**Change 1: Add fallbacks to the model config.** Find the `model` section inside `agents.defaults`:

```json
"model": {
    "primary": "anthropic/claude-opus-4-6"
}
```

Replace it with:

```json
"model": {
    "primary": "anthropic/claude-opus-4-6",
    "fallbacks": ["ollama/qwen3:8b"]
}
```

This keeps Claude as the primary model for all real work. The local model is only used if the Claude API is unavailable (downtime, rate limiting). This is important because smaller local models are much more vulnerable to prompt injection and produce lower-quality code.

**Change 2: Add a top-level `models` section.** Add this at the top level of the JSON (with correct comma separation):

```json
"models": {
    "mode": "merge",
    "providers": {
        "ollama": {
            "baseUrl": "http://127.0.0.1:11434/v1",
            "apiKey": "ollama-local",
            "api": "openai-completions",
            "models": [
                {
                    "id": "qwen3:1.7b",
                    "name": "Qwen3 1.7B",
                    "reasoning": false,
                    "input": ["text"],
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                    "contextWindow": 32768,
                    "maxTokens": 8192
                },
                {
                    "id": "qwen3:8b",
                    "name": "Qwen3 8B",
                    "reasoning": false,
                    "input": ["text"],
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                    "contextWindow": 32768,
                    "maxTokens": 8192
                },
                {
                    "id": "gemma3:4b",
                    "name": "Gemma3 4B",
                    "reasoning": false,
                    "input": ["text"],
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                    "contextWindow": 8192,
                    "maxTokens": 8192
                },
                {
                    "id": "gemma3:1b",
                    "name": "Gemma3 1B",
                    "reasoning": false,
                    "input": ["text"],
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                    "contextWindow": 8192,
                    "maxTokens": 8192
                },
                {
                    "id": "qwen3-vl:2b",
                    "name": "Qwen3 VL 2B",
                    "reasoning": false,
                    "input": ["text", "image"],
                    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
                    "contextWindow": 8192,
                    "maxTokens": 8192
                }
            ]
        }
    }
}
```

> **Note:** The models `gemma3:4b` and `qwen3-vl:2b` are registered here but not yet downloaded. To use them, pull them via Ollama when ready:
>
> ```bash
> ollama pull gemma3:4b
> ollama pull qwen3-vl:2b
> ```
>
> Registering models before downloading them is harmless — OpenClaw will report them as unavailable until they are pulled.

Configuration explained:

| Key | Purpose |
|-----|---------|
| `"mode": "merge"` | Keeps all built-in providers (Anthropic) and adds Ollama alongside them. Without this, Ollama would replace everything. |
| `"baseUrl"` | Points to Ollama's OpenAI-compatible API endpoint on localhost. The `/v1` suffix is required. |
| `"apiKey": "ollama-local"` | Ollama doesn't require a real key, but OpenClaw needs a non-empty value for its availability check. |
| `"api": "openai-completions"` | Tells OpenClaw to use the OpenAI-compatible completions protocol. |
| `"cost": all zeros` | These models run locally — no per-token charges. |
| `"input": ["text", "image"]` on qwen3-vl | Marks this as a vision model that can process images. |
| `"contextWindow"` | Maximum tokens the model can consider. qwen3:8b supports 32k; the smaller models are limited to 8k. |

### Step 19: Ensure no OLLAMA_API_KEY in the .env file

If `OLLAMA_API_KEY` is present in `~/.openclaw/.env`, OpenClaw will attempt auto-discovery alongside your explicit config. On the Pi 5, auto-discovery times out and produces a spurious error at startup. Since the API key is already defined in the explicit provider block, the env var is unnecessary.

Check the file:

```bash
cat ~/.openclaw/.env
```

If you see a line like `OLLAMA_API_KEY=ollama-local`, remove it:

```bash
nano ~/.openclaw/.env
```

Delete the `OLLAMA_API_KEY=...` line and save. The file should contain only:

```
OPENCLAW_DISABLE_BONJOUR=1
```

(Plus any other non-Ollama variables you may have.)

### Step 20: Validate, restart, and verify

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null
systemctl --user start openclaw-gateway
openclaw models list
```

Expected output:

```
Model                                      Input      Ctx      Local Auth  Tags
anthropic/claude-opus-4-6                  text+image 195k     no    yes   default,configured,alias:opus
ollama/qwen3:8b                            text       32k      yes   yes   fallback#1
```

Only `qwen3:8b` appears because it's the only model configured as a fallback. The other four models (qwen3:1.7b, gemma3:4b, gemma3:1b, qwen3-vl:2b) are registered and available — you can switch to them manually in Telegram using the `/model` command, but they won't be used automatically unless added to the fallback chain.

---

## Verification Checklist

- [ ] Telegram installed on your phone with **2FA enabled**
- [ ] Bot created via `@BotFather` with token saved in a password manager
- [ ] Group joining disabled in BotFather (`/setjoingroups` → Disable)
- [ ] `channels.telegram` added to `openclaw.json` with:
  - [ ] `dmPolicy` set to `"allowlist"`
  - [ ] `allowFrom` contains **only** your numeric Telegram user ID
  - [ ] `groupPolicy` set to `"disabled"`
- [ ] Telegram plugin enabled (`plugins.entries.telegram.enabled: true`)
- [ ] Gateway running — bot responds to your messages in Telegram
- [ ] Bot does NOT respond to messages from other users
- [ ] Terminal history cleared (`history -c`)
- [ ] `models` section added with explicit Ollama provider (5 models defined)
- [ ] `agents.defaults.model.fallbacks` includes `ollama/qwen3:8b`
- [ ] No `OLLAMA_API_KEY` in `~/.openclaw/.env`
- [ ] `openclaw models list` shows both Claude and the Ollama fallback
- [ ] `openclaw security audit --deep` — **0 critical issues**
- [ ] `openclaw doctor` — clean, shows `Telegram: ok`

---

## Troubleshooting

### `Unit openclaw.service could not be found`

The service is named `openclaw-gateway`, not `openclaw`. All systemctl commands must use:

```bash
systemctl --user <action> openclaw-gateway
```

To discover the correct service name:

```bash
systemctl --user list-units --type=service --all | grep -i claw
```

### Telegram does not appear in logs or `openclaw channels status`

The Telegram plugin is a **bundled plugin** that is disabled by default if you skipped channel setup during onboarding. Ensure `plugins.entries.telegram.enabled` is set to `true` in `openclaw.json`. The `channels.telegram` config block alone is not sufficient.

### `curl getUpdates` returns empty results or `{"ok":true,"result":[]}`

The gateway was running in polling mode and already consumed your messages. Polling fetches and marks messages as delivered — once consumed, they're gone from Telegram's queue. Always **stop the gateway first** (`systemctl --user stop openclaw-gateway`), then send a new message, then run the curl command.

### `Failed to discover Ollama models: TimeoutError`

Ollama auto-discovery calls `/api/show` for each model to check capabilities. On the Raspberry Pi 5 this can time out. The solution is explicit provider configuration (Step 18) and removing `OLLAMA_API_KEY` from `~/.openclaw/.env` (Step 19) so OpenClaw doesn't attempt auto-discovery at all. Your explicitly defined models will work regardless of this timeout.

### Bot shows single checkmark but never double-checks / no reply

This means your message reached Telegram's servers but the bot hasn't read it. Check:

1. `openclaw channels status` — does it show Telegram as `running`?
2. Is the Telegram plugin enabled? (see above)
3. Is your user ID in `allowFrom`? If not, the gateway silently drops your message.
4. Check logs: `openclaw logs --follow` — look for errors related to Telegram or your message.

### JSON validation error after editing config

Common causes:

- **Missing comma** between sibling blocks (e.g., after `}` when another key follows)
- **Trailing comma** after the last item in an object or array
- **Mismatched braces/brackets**

The validation command (`python3 -m json.tool`) will report the line number of the error. Use `nano +<LINE_NUMBER> ~/.openclaw/openclaw.json` to jump directly to it.

### Security audit shows `gateway.trusted_proxies_missing` warning

Safe to ignore. This warning applies only if you expose the Control UI through a reverse proxy. With your gateway bound to loopback and Telegram as your access channel, no reverse proxy is involved.

# Phase 6 — Setting Up OpenClaw for Coding & Research

OpenClaw is configured and running on your Raspberry Pi 5. This phase creates a dedicated GitHub account for OpenClaw's coding work, backs up the agent workspace, enables the sandbox to push code to GitHub, sets up web search for research tasks, and verifies the full coding workflow end-to-end.

## Prerequisites

Before starting this phase, you should have completed:

- **Phase 2:** Raspberry Pi OS installed and hardened; `openclaw` service user created (no sudo privileges); your admin user (e.g., `<ADMIN_USER>`) with sudo
- **Phase 3:** Ollama installed; Git already installed on the Pi
- **Phase 4:** OpenClaw installed and configured (`~/.openclaw/openclaw.json` at `600`, `~/.openclaw/` at `700`); Docker sandboxing enabled with `network: "bridge"`
- **Phase 5:** Telegram (or other messaging channel) connected and tested
- You are SSH'd into the Pi as the `openclaw` user

---

## Part 1 — Create a Dedicated GitHub Account

### Step 1: Create a new email address

Create a free email account (Gmail, Outlook, or ProtonMail) that is **not** your personal email. This email will only be used for OpenClaw's GitHub account.

Example: `openclaw-<YOUR_NAME>@gmail.com`

### Step 2: Create a new GitHub account

1. Go to [github.com](https://github.com) in your browser (on your personal computer — not on the Pi).
2. Click **Sign up**.
3. Use the new email address from Step 1.
4. Choose a username that identifies this as your bot's account (e.g., `<YOUR_NAME>-openclaw-bot`).
5. Complete the sign-up process.

### Step 3: Generate a Fine-Grained Personal Access Token (PAT)

A Personal Access Token is a scoped credential that lets OpenClaw interact with GitHub on behalf of this account. Unlike a password, you can limit exactly what it can do and revoke it instantly.

1. Log into the new GitHub account.
2. Click your profile picture (top right) → **Settings**.
3. Scroll down the left sidebar → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
4. Click **Generate new token**.
5. **Token name:** `openclaw-pi-access`
6. **Expiration:** 90 days. (When it expires, generate a new one. This limits damage if the token leaks.)
7. **Repository access:** "All repositories" (this account has nothing personal on it).
8. **Permissions** — grant Read and Write access to the following:

   | Permission       | Access     | Why                                        |
   |------------------|------------|--------------------------------------------|
   | Actions          | Read/Write | Run and manage GitHub Actions workflows    |
   | Administration   | Read/Write | Create/manage repositories programmatically|
   | Commit statuses  | Read/Write | Report build/test status on commits        |
   | Contents         | Read/Write | Create and push code                       |
   | Deployments      | Read/Write | Manage GitHub Pages deployments            |
   | Issues           | Read/Write | Create and manage issues                   |
   | Metadata         | Read-only  | Required by GitHub                         |
   | Pages            | Read/Write | Enable and configure GitHub Pages          |
   | Pull requests    | Read/Write | Create and manage PRs                      |
   | Secrets          | Read/Write | Manage repository secrets for CI/CD        |
   | Workflows        | Read/Write | Trigger and manage workflow runs           |

9. Click **Generate token**.
10. **Copy the token immediately** and save it in a password manager. You will not be able to see it again.

> ⚠️ **Security Note:** The `Secrets` permission grants read/write access to repository secrets (used to store API keys for CI/CD pipelines). If the token were compromised via prompt injection, an attacker could read or inject secrets. This is acceptable now because the dedicated account has no sensitive secrets stored, but reconsider this permission if you later store real credentials in GitHub Actions. You can always generate a new token with fewer permissions and swap it in.

### Step 4: Configure Git on the Raspberry Pi

SSH into the Pi as the `openclaw` user. Git should already be installed from a previous phase.

```bash
git config --global user.name "<YOUR_OPENCLAW_GITHUB_USERNAME>"
git config --global user.email "<YOUR_OPENCLAW_EMAIL>"
```

These commands tell Git to label all commits as coming from the dedicated OpenClaw account. Replace the values with whatever you used when creating the GitHub account.

### Step 5: Configure the Git credential helper

```bash
git config --global credential.helper store
```

This tells Git to remember your credentials after you type them once. The next time a `git push` occurs, Git will prompt for a username and password — use the GitHub username and paste the PAT as the password. After that, it remembers.

> **Note:** `credential.helper store` saves the token in plaintext at `~/.git-credentials`. This is acceptable because the Pi is an isolated, single-purpose device that only you can SSH into. On a shared machine, you would use a more secure credential store.

### Step 6: Back up the workspace to a private GitHub repository

The [official OpenClaw documentation](https://docs.openclaw.ai/concepts/agent-workspace) recommends backing up the agent workspace (`~/.openclaw/workspace`) to a private Git repository. The workspace contains personality files (`SOUL.md`, `IDENTITY.md`, `USER.md`, etc.) and memory logs — not credentials.

```bash
cd ~/.openclaw/workspace
git init
git add .
git commit -m "Initial workspace"
```

- `git init` — initializes version tracking in this folder.
- `git add .` — stages all files for the first commit.
- `git commit -m "Initial workspace"` — creates a save point with all current files.

Expected output (file list will vary):

```
[master (root-commit) xxxxxxx] Initial workspace
 8 files changed, 311 insertions(+)
 create mode 100644 AGENTS.md
 create mode 100644 BOOTSTRAP.md
 create mode 100644 HEARTBEAT.md
 create mode 100644 IDENTITY.md
 create mode 100644 SOUL.md
 create mode 100644 TOOLS.md
 create mode 100644 USER.md
 create mode 100644 memory/.gitkeep
```

Now create a **private** repository on GitHub:

1. Go to [github.com](https://github.com) (logged into the OpenClaw account).
2. Click the **+** button → **New repository**.
3. Name it `openclaw-workspace`.
4. Select **Private**.
5. Do **NOT** check "Initialize with README."
6. Click **Create repository**.
7. Copy the HTTPS URL (e.g., `https://github.com/<YOUR_OPENCLAW_GITHUB_USERNAME>/openclaw-workspace.git`).

Back on the Pi:

```bash
git remote add origin https://github.com/<YOUR_OPENCLAW_GITHUB_USERNAME>/openclaw-workspace.git
git branch -M main
git push -u origin main
```

When prompted for credentials, enter the GitHub username and paste the PAT as the password.

- `git remote add origin <url>` — links the local repo to the GitHub repository.
- `git branch -M main` — renames the default branch to `main`.
- `git push -u origin main` — uploads the code. The `-u` flag sets this as the default push target.

Secure the stored credentials:

```bash
chmod 600 ~/.git-credentials
```

> `git credential.helper store` saves the token in plaintext. Unlike files inside `~/.openclaw/` (which is protected by its `700` directory permissions), `~/.git-credentials` sits in `/home/openclaw/` which is typically world-readable (`755`). Setting `600` prevents other users on the Pi from reading the token.

### Part 1 Checklist

- [ ] New email address created (not your personal one)
- [ ] New GitHub account created with that email
- [ ] Fine-grained PAT generated with the permissions listed above, 90-day expiry
- [ ] Token saved in your password manager
- [ ] Git configured on the Pi with the OpenClaw account's name and email
- [ ] Credential helper configured (`store`)
- [ ] Workspace initialized as a Git repo and pushed to a **private** GitHub repository
- [ ] `git push` completed without errors

---

## Part 2 — Set Up Web Search for Research

OpenClaw uses the Brave Search API for web research via the `web_search`
tool. For JavaScript-heavy websites that `web_fetch` can't handle, the
browser tool (enabled in Phase 4, Step 21) provides full Chromium control.
The Brave Search API key below powers `web_search` specifically.

### Step 1: Obtain a Brave Search API key

1. Go to [brave.com/search/api/](https://brave.com/search/api/) on your personal computer.
2. Create an account and choose the free tier ("Data for Search" plan).
3. Generate an API key.

### Step 2: Add the API key to OpenClaw's environment

```bash
nano ~/.openclaw/.env
```

Add this line:

```
BRAVE_API_KEY=<YOUR_BRAVE_SEARCH_API_KEY>
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`). OpenClaw's `web_search` tool will automatically use Brave Search when this key is present — no config change needed.

Verify permissions are still restrictive after editing:

```bash
ls -la ~/.openclaw/.env
```

Expected: `-rw-------`

If it shows `-rw-r--r--` (can happen if a new file was created instead of appended):

```bash
chmod 600 ~/.openclaw/.env
```

### Part 2 Checklist

- [ ] Brave Search API key obtained
- [ ] Key added to `~/.openclaw/.env`

---

## Part 3 — Enable the Sandbox to Push Code to GitHub

If your sandbox is configured with `network: "bridge"` (set in Phase 4), it already has outbound internet access. This part focuses on adding GitHub credentials to the sandbox environment so OpenClaw can `git push` from inside the container. If your sandbox still uses `network: "none"`, update it to `"bridge"` as shown in Step 2 below.

> ⚠️ **Security Note:** Changing the sandbox network from `"none"` to `"bridge"` allows the sandbox to make outbound internet connections. If a prompt injection attack tricked OpenClaw into running a malicious command, it could potentially send data outbound. Your network isolation (the Pi on a separate VLAN/guest network) is the safety net — even if data leaves the Pi, it cannot reach your personal devices. You can revert to `"none"` at any time.

### Step 1: Add the GitHub token to the environment file

```bash
nano ~/.openclaw/.env
```

Add this line (below the Brave key if already present):

```
GITHUB_TOKEN=<YOUR_GITHUB_PAT>
```

Save and exit.

Verify permissions are still restrictive:

```bash
ls -la ~/.openclaw/.env
```

Expected: `-rw-------`

If it shows `-rw-r--r--`:

```bash
chmod 600 ~/.openclaw/.env
```

### Step 2: Update the sandbox configuration

```bash
nano ~/.openclaw/openclaw.json
```

Locate the `agents.defaults.sandbox.docker` section. Update `network` from `"none"` to `"bridge"` and add the `env` block with Git credentials. The relevant section should look like this:

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "docker": {
          "network": "bridge",
          "user": "<OPENCLAW_UID>:<OPENCLAW_UID>",
          "env": {
            "GIT_AUTHOR_NAME": "<YOUR_OPENCLAW_GITHUB_USERNAME>",
            "GIT_AUTHOR_EMAIL": "<YOUR_OPENCLAW_EMAIL>",
            "GIT_COMMITTER_NAME": "<YOUR_OPENCLAW_GITHUB_USERNAME>",
            "GIT_COMMITTER_EMAIL": "<YOUR_OPENCLAW_EMAIL>",
            "GITHUB_TOKEN": "<YOUR_GITHUB_PAT>"
          }
        }
      }
    }
  }
}
```

> **Note:** Only the fields being added or changed are shown. Keep all your existing settings (`mode`, `scope`, `workspaceAccess`, `image`, `readOnlyRoot`) intact.

> **Note:** The sandbox does **not** inherit the host's `process.env`. Environment variables must be set explicitly in `agents.defaults.sandbox.docker.env`. The OpenClaw docs confirm this: sandbox containers are isolated from the host environment. This means the token must be placed directly in this config block. The file is already permission-locked to `600` (only the `openclaw` user can read it), limiting exposure.

Save and exit.

### Step 3: Validate the JSON

Before restarting, check that your config file is valid:

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null
```

If this command produces no output, the JSON is valid. If it prints an error, re-edit the file and fix the syntax.

### Step 4: Restart the OpenClaw gateway

```bash
systemctl --user restart openclaw-gateway
```

> **Note:** The systemd service is named `openclaw-gateway`, not `openclaw`. The command `openclaw restart` is not a valid CLI command — `/restart` is a slash command sent through the messaging channel. To restart from the terminal, always use `systemctl`.

Verify it's running:

```bash
systemctl --user status openclaw-gateway
```

You should see `active (running)` in the output.

### Part 3 Checklist

- [ ] `GITHUB_TOKEN` added to `~/.openclaw/.env`
- [ ] Sandbox config updated: `network: "bridge"`, `env` block with Git credentials
- [ ] JSON validated without errors
- [ ] File permissions still correct (`openclaw.json` is `600`)
- [ ] Gateway restarted with `systemctl --user restart openclaw-gateway`
- [ ] Gateway status confirmed as `active (running)`

---

## Part 4 — Test the Full Coding Workflow

### Step 1: Send a test project request

Through your messaging channel (Telegram), send OpenClaw a message like:

> Create a simple HTML page that says "Hello from OpenClaw" with some nice styling. Initialize a git repo, commit the code, and push it to a new public repository called "hello-test" on GitHub.

### Step 2: Verify on GitHub

Check the dedicated GitHub account in your browser. The new repository should appear with the committed code.

### Step 3: View the rendered webpage with GitHub Pages

GitHub Pages hosts static websites for free directly from a repository.

1. Go to the repo on GitHub (logged into the OpenClaw account).
2. **Settings** → **Pages** (in the left sidebar).
3. Under **Source**, select **Deploy from a branch**.
4. Pick the `main` branch, `/ (root)` folder.
5. Click **Save**.

Within a minute or two, the page will be live at:

```
https://<YOUR_OPENCLAW_GITHUB_USERNAME>.github.io/hello-test/
```

> **Note:** GitHub Pages on the free plan requires **public** repositories. This is fine — these are throwaway prototypes on a dedicated bot account with no personal data.

### Part 4 Checklist

- [ ] Sent a test coding + push request through the messaging channel
- [ ] OpenClaw created files, committed, and pushed successfully
- [ ] Repository appeared on GitHub with the correct code
- [ ] (Optional) GitHub Pages enabled and webpage accessible

---

## Part 5 — Safe Review Habits

These are not configuration steps — they are practices to follow as you use OpenClaw for real projects.

**Always review before you trust.** OpenClaw can write working code, but it can also introduce bugs, security flaws, or unwanted dependencies. Before using any prototype, read through the code. Open GitHub Pages links and test the behavior.

**Check what it committed.** On the GitHub repo page, click into the **Commits** tab. Verify it only committed what you asked for — no extra files, no credentials, no unexpected changes.

**Use `/status` regularly.** This slash command (sent in Telegram) shows the current model, token usage, and cost for the session. Build a habit of checking it during long sessions.

**Use `/new` between projects.** This slash command resets the session (clears conversation history). Each new message after `/new` only sends your request plus the system prompt — cheaper and faster. Use it when switching between unrelated tasks.

**Use `/compact` during long sessions.** This summarizes older conversation history into a shorter form, freeing up tokens while preserving important context. Use it when a single task requires a long back-and-forth.

**If something feels off, stop and check logs:**

```bash
cat ~/.openclaw/agents/*/sessions/*.jsonl | tail -50
```

Or send `/stop` in the chat to immediately halt whatever OpenClaw is doing.

---

## Verification — Phase 6 Complete

- [ ] Dedicated GitHub account created (separate from your personal account)
- [ ] Workspace backed up to a private GitHub repository
- [ ] Brave Search API key configured
- [ ] Sandbox configured with network access and GitHub credentials
- [ ] Full coding workflow tested: describe → OpenClaw builds → code pushed to GitHub
- [ ] (Optional) GitHub Pages enabled for viewing prototypes
- [ ] Review habits understood: `/new`, `/compact`, `/status`, `/stop`

---

## Troubleshooting

### `openclaw restart` returns "unknown command"

`restart` is not a CLI command. Use `systemctl --user restart openclaw-gateway` from the terminal, or send `/restart` as a slash command through the messaging channel.

### Service name not found (`Unit openclaw.service not found`)

The systemd service is named `openclaw-gateway`, not `openclaw`. Find the exact name with:

```bash
systemctl --user list-units --type=service | grep -i openclaw
```

### OpenClaw cannot push to GitHub from the sandbox

This happens when the sandbox still has `network: "none"` or is missing the `GITHUB_TOKEN` in its `env` block. The sandbox does **not** inherit host environment variables — credentials must be explicitly set in `agents.defaults.sandbox.docker.env` within `openclaw.json`.

### `sudo` commands fail as the `openclaw` user

By design, the `openclaw` user has no sudo privileges. Any packages that need installing should be installed by your admin user (e.g., `<ADMIN_USER>`). Git should already be installed from a previous phase.

### JSON validation fails after editing `openclaw.json`

OpenClaw accepts JSON5 format (which supports comments `//` and trailing commas), but all configuration blocks in this guide use **strict JSON** for maximum compatibility. The validation command `python3 -m json.tool` validates strict JSON only.

If you add JSON5-specific syntax (comments, trailing commas), `python3 -m json.tool` will report errors. In that case, skip the validation step and rely on `openclaw doctor` after restarting the gateway to catch config issues.


# Phase 6.5: Google Drive Access for Document Sharing

**What this phase accomplishes:** Configure the Pi so that OpenClaw can upload reports and documents to a dedicated Google Drive account, allowing you to access files from any device without needing to SSH into the Pi.

**Prerequisites:** Phases 1–6 complete. You have a dummy Gmail account created specifically for OpenClaw (the same one used for the GitHub account, or a separate one — your choice).

**Why this phase exists:** OpenClaw runs inside a Docker sandbox. Files it creates are only accessible via the shared workspace directory (`~/.openclaw/workspace/`). While you *can* SSH in and retrieve files, it's much more convenient to have OpenClaw upload them directly to a Google Drive you can access from your phone or laptop.

**Security note:** The Google Drive account must be a **dedicated, throwaway account** — never your personal one. If OpenClaw's credentials are compromised, the attacker only gets access to an empty Google Drive, not your personal files.

---

## Critical: How to SSH In Correctly

Throughout this phase you will need two types of SSH sessions — one as your **admin user** (for installing system packages) and one as the **`openclaw` user** (for everything else). Getting this wrong causes subtle, confusing failures.

> ⚠️ **The #1 gotcha in this phase:** You **must** SSH in directly as the target user. **Never** use `su openclaw` or `sudo su - openclaw` to switch users after logging in. Switching users this way does not start a proper systemd user session, which causes `systemctl --user` commands to fail with:
>
> ```
> Failed to connect to user scope bus via local transport: Operation not permitted
> ```

**If connecting via Tailscale SSH:**

By default, Tailscale SSH may log you in as `root`. You must specify the user explicitly:

```bash
# ✅ CORRECT — specify the user before the hostname
ssh openclaw@openclaw-pi

# ✅ CORRECT — admin user
ssh <ADMIN_USER>@openclaw-pi

# ❌ WRONG — lands as root, then switching user breaks systemd
ssh openclaw-pi
su openclaw
```

**If connecting via the isolated network directly:**

```bash
# ✅ CORRECT
ssh openclaw@<RASPBERRY_PI_IP>

# ✅ CORRECT — admin user
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

**How to verify you're in the right session:**

```bash
whoami && pwd
```

| User | Expected output |
|---|---|
| Admin | `<ADMIN_USER>` and `/home/<ADMIN_USER>` |
| OpenClaw | `openclaw` and `/home/openclaw` |

If you see `/root` as your working directory, you're logged in as root — exit and reconnect as the correct user.

---

## Part A — Install rclone on the Pi

`rclone` is a command-line tool that syncs files to cloud storage (Google Drive, Dropbox, etc.). Think of it as a bridge between the Pi's filesystem and cloud storage.

### 1. Install rclone (as admin user)

SSH in as your **admin user** (not `openclaw` — the `openclaw` user cannot install system packages):

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

Or via Tailscale:

```bash
ssh <ADMIN_USER>@openclaw-pi
```

Then install:

```bash
sudo apt install -y rclone
```

Verify:

```bash
rclone --version
```

Expected: A version string like `rclone v1.x.x`.

### 2. Install rclone on your laptop too

You will need rclone on your laptop to complete the Google authentication (the Pi has no web browser).

- **macOS:** `brew install rclone`
- **Windows:** Download from [rclone.org/downloads](https://rclone.org/downloads/)
- **Linux:** `sudo apt install rclone`

Verify on your laptop:

```bash
rclone --version
```

### 3. Exit and reconnect as the openclaw user

```bash
exit
ssh openclaw@<RASPBERRY_PI_IP>
```

Or via Tailscale:

```bash
ssh openclaw@openclaw-pi
```

Verify: `whoami` returns `openclaw` and `pwd` returns `/home/openclaw`.

---

## Part B — Authenticate rclone with the Dummy Google Account

This step connects rclone to your dummy Google Drive. Because the Pi is headless (no web browser), we authorise on your laptop and transfer the token to the Pi.

### 4. Start rclone configuration on the Pi

```bash
rclone config
```

Follow these prompts:

| Prompt | Selection | Why |
|---|---|---|
| `n/s/q>` | `n` (New remote) | Create a new cloud storage connection |
| `name>` | `openclaw-gdrive` | A label for this connection |
| `Storage>` | `drive` (or type the number next to "Google Drive") | We're connecting to Google Drive |
| `client_id>` | Press Enter (leave blank) | Uses rclone's built-in client ID |
| `client_secret>` | Press Enter (leave blank) | Uses rclone's built-in client secret |
| `scope>` | `1` (Full access) | OpenClaw needs to create and upload files |
| `service_account_file>` | Press Enter (leave blank) | Not using a service account |
| `Edit advanced config?` | `n` (No) | Defaults are fine |
| `Use auto config?` | `n` (No) | The Pi is headless — no browser available |

Rclone will now display a command like this:

```
For this to work, you will need rclone available on a machine that has
a web browser available.

Execute the following on the machine with the web browser (same rclone
version recommended):

        rclone authorize "drive" "eyJjbGll...long-encoded-string..."

Then paste the result.
config_token>
```

**Leave this terminal open and waiting.** Do not press anything. We now switch to your laptop.

### 5. Authorise on your laptop

Open a **new, separate terminal window** on your laptop (keep the Pi's SSH session open).

Copy-paste the **exact command** shown on the Pi (including the long encoded string in quotes):

```bash
rclone authorize "drive" "eyJjbGll...the-exact-string-from-your-Pi..."
```

> ⚠️ **Important:** Copy the complete command from the Pi's terminal. The long encoded string after `"drive"` contains your remote's configuration. Don't just type `rclone authorize "drive"` without it.

**What happens next:**

1. Your laptop's default browser opens to a Google sign-in page.
2. **Sign in with your dedicated dummy Gmail account** — NOT your personal Google account.
3. Google may show a warning: **"This app isn't verified."** This is normal for rclone.
   - Click **Advanced** → **Go to rclone (unsafe)** → **Allow**.
4. The browser shows **"Success!"** and your laptop's terminal displays a token:

```
Paste the following into your remote machine --->
{"access_token":"ya29.EXAMPLE_TOKEN...","token_type":"Bearer","refresh_token":"1//EXAMPLE_REFRESH...","expiry":"2026-..."}
<---End paste
```

### 6. Paste the token back on the Pi

1. Copy the **entire JSON blob** from your laptop's terminal — everything from `{` to `}` inclusive.
2. Switch back to your Pi's SSH session (which is still waiting at `config_token>`).
3. Paste the token and press **Enter**.

Continue with the remaining prompts:

| Prompt | Selection | Why |
|---|---|---|
| `Configure this as a Shared Drive (Team Drive)?` | `n` (No) | Using a personal Drive |
| `Keep this "openclaw-gdrive" remote?` | `y` (Yes) | Save the configuration |
| `q` | Quit config | Done |

### 7. Test the connection

```bash
rclone lsd openclaw-gdrive:
```

Expected: An empty listing (the Drive is new) or a list of any existing folders. If you see an error, re-run `rclone config`, select `e` (Edit existing remote), choose `openclaw-gdrive`, and repeat the authorisation flow from Step 4.

### 8. Create a folder structure on Google Drive

```bash
rclone mkdir openclaw-gdrive:OpenClaw/reports
rclone mkdir openclaw-gdrive:OpenClaw/projects
```

Verify:

```bash
rclone lsd openclaw-gdrive:OpenClaw
```

Expected: Two folders listed (`reports` and `projects`).

---

## Part C — Make rclone Available Inside the Sandbox

The Docker sandbox has its own filesystem and does NOT have access to host tools by default. To let OpenClaw use rclone from inside the sandbox, we need to: (1) build a new sandbox image that includes rclone, (2) mount the rclone credentials into the container, and (3) tell OpenClaw to use the new image.

### 9. Build a custom sandbox image with rclone

```bash
cat > /tmp/Dockerfile.sandbox-gdrive << 'EOF'
FROM openclaw-sandbox:bookworm-slim
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends rclone && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
USER claw
EOF
```

```bash
docker build -t openclaw-sandbox:gdrive -f /tmp/Dockerfile.sandbox-gdrive /tmp
```

Verify:

```bash
docker images | grep openclaw-sandbox
```

Expected: Two images listed — `bookworm-slim` (your original) and `gdrive` (the new one).

### 10. Stop the gateway and update the OpenClaw config

```bash
systemctl --user stop openclaw-gateway
nano ~/.openclaw/openclaw.json
```

Find the `agents.defaults.sandbox.docker` section and make two changes:

**Change 1:** Update the image name:

```json
"docker": {
    "image": "openclaw-sandbox:gdrive",
```

**Change 2:** Add the rclone config to the bind mounts. Add a `binds` array inside the `docker` block (alongside `network`, `readOnlyRoot`, etc.):

```json
"docker": {
    "image": "openclaw-sandbox:gdrive",
    "network": "bridge",
    "readOnlyRoot": false,
    "user": "<OPENCLAW_UID>:<OPENCLAW_UID>",
    "binds": [
        "/home/openclaw/.config/rclone:/home/claw/.config/rclone:ro"
    ],
    "env": {
        ...existing env entries (GIT_AUTHOR_NAME, etc.)...
    }
}
```

> Use the same UID you noted in Phase 4, Step 15 (e.g., `"1001:1001"`).
> This must match Phase 4's config — the container user and host user
> must have the same UID for bind-mounted files to be accessible.

**What each change does:**

| Key | Value | Purpose |
|---|---|---|
| `"image"` | `"openclaw-sandbox:gdrive"` | Uses the new image with rclone pre-installed |
| `"binds"` | rclone config path with `:ro` | Mounts the rclone credentials (read-only) into the container so rclone can authenticate with Google Drive |

> ⚠️ **Security Note — Bind mounts:** The `:ro` at the end means **read-only**. The sandbox can read the rclone credentials to authenticate with Google Drive, but cannot modify or delete them. This is the least-privilege approach.

Save and exit: `Ctrl+O`, `Enter`, `Ctrl+X`.

### 11. Verify rclone.conf permissions

If you followed Phase 4's dynamic UID approach (where the Dockerfile's
`useradd` UID matches your `openclaw` user's UID), bind-mounted files
are readable by the container without loosening permissions.

Verify:

```bash
id -u
```

This should match the UID used in your Dockerfile from Phase 4, Step 15,
and the `"user"` field in `openclaw.json`. If they match, no permission
changes are needed — `rclone.conf` can stay at its default `600`.

If, for any reason, the UIDs don't match (e.g., you rebuilt the sandbox
image without the dynamic UID), you have two options:

1. **Recommended:** Rebuild the sandbox image with the correct UID:
   ```bash
   OPENCLAW_UID=$(id -u)
   # Re-run the Dockerfile build from Phase 4, Step 15, then:
   docker build -t openclaw-sandbox:gdrive -f /tmp/Dockerfile.sandbox-gdrive /tmp
   openclaw sandbox recreate --all
   ```

2. **Quick workaround:** Loosen the file permissions:
   ```bash
   chmod 644 ~/.config/rclone/rclone.conf
   ```
   This allows any local user to read the file. Acceptable on this
   single-purpose, isolated Pi, but less clean than fixing the UID.

### 12. Validate the JSON and restart the gateway

```bash
cat ~/.openclaw/openclaw.json | python3 -m json.tool > /dev/null
```

If no output appears, the JSON is valid. If you see an error, re-open the file and fix the syntax (usually a missing or extra comma).

Now restart:

```bash
systemctl --user restart openclaw-gateway
systemctl --user status openclaw-gateway
```

Expected: `active (running)`.

> ⚠️ **If you see `Failed to connect to user scope bus via local transport: Operation not permitted`:** You are not in a direct SSH session as the `openclaw` user. This happens when you used `su openclaw` or `sudo su - openclaw` to switch users, or when Tailscale SSH logged you in as root. **Fix:** Exit completely (`exit`, possibly twice), then reconnect with `ssh openclaw@<RASPBERRY_PI_IP>` or `ssh openclaw@openclaw-pi`. See the "Critical: How to SSH In Correctly" section at the top of this phase.

### 13. Recreate sandbox containers

The existing sandbox containers still use the old image. Force them to rebuild:

```bash
openclaw sandbox recreate --all
```

OpenClaw will list the containers to be removed and show a confirmation prompt:

```
◆  This will stop and remove these containers. Continue?
│  ○ Yes / ● No
```

> **UI note:** The filled circle `●` indicates the currently selected option. By default, **No** is selected. Use the **left arrow key ←** to move the selection to **Yes**, then press **Enter** to confirm.

The old containers will be removed. They are automatically recreated with the new `openclaw-sandbox:gdrive` image the next time OpenClaw needs them (i.e., when you send it a message via Telegram).

---

## Part D — Test the Integration

### 14. Test from SSH first

Verify rclone works from the `openclaw` user on the host:

```bash
echo "Test file from Pi" > /tmp/test-upload.txt
rclone copy /tmp/test-upload.txt openclaw-gdrive:OpenClaw/reports/
rclone ls openclaw-gdrive:OpenClaw/reports/
```

Expected: `test-upload.txt` listed. Check Google Drive from your browser — the file should be there.

Clean up:

```bash
rclone delete openclaw-gdrive:OpenClaw/reports/test-upload.txt
rm /tmp/test-upload.txt
```

### 15. Test via Telegram

Send OpenClaw a message through Telegram:

> Create a short text file called "hello.txt" containing "Hello from OpenClaw!" and save it to /workspace/reports/. Then upload it to Google Drive by running: `rclone copy /workspace/reports/hello.txt openclaw-gdrive:OpenClaw/reports/`

Check Google Drive — `hello.txt` should appear in the `OpenClaw/reports` folder.

### 16. Teach OpenClaw the workflow

For best results, when you ask OpenClaw to create reports, include the upload step in your instructions:

> Create a report about [topic]. Save the report to /workspace/reports/[filename]. After saving, upload it to Google Drive: `rclone copy /workspace/reports/[filename] openclaw-gdrive:OpenClaw/reports/`

**Pro tip:** You can create a reusable instruction by adding a note to OpenClaw's system prompt (in the AGENTS.md file in the workspace). This way you don't have to repeat the upload command every time. Example line to add:

```
When creating reports or documents, always save them to /workspace/reports/ and then upload them to Google Drive using: rclone copy /workspace/reports/<filename> openclaw-gdrive:OpenClaw/reports/
```

To add this:

```bash
nano ~/.openclaw/workspace/AGENTS.md
```

Add the instruction, save (`Ctrl+O`, `Enter`, `Ctrl+X`), and restart:

```bash
systemctl --user restart openclaw-gateway
```

---

## Part E — Run Security Checks

### 17. Audit

```bash
openclaw security audit --deep
openclaw doctor
```

Expected: 0 critical issues.

### 18. Verify file permissions

```bash
ls -la ~/.config/rclone/rclone.conf
```

Expected: `-rw-------` (600 — readable only by the openclaw user). If the
UID strategy from Phase 4 was followed correctly, 600 is sufficient because
the container user and host user share the same UID.

If permissions are wrong:

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

---

## Verification

- [ ] rclone installed on the Pi (`rclone --version`) and on your laptop
- [ ] Authenticated with the **dedicated dummy Gmail account** (not personal)
- [ ] `rclone lsd openclaw-gdrive:OpenClaw` shows `reports` and `projects` folders
- [ ] Custom sandbox image built (`docker images | grep gdrive`)
- [ ] `openclaw.json` updated with new image name and rclone bind mount (`:ro`)
- [ ] rclone config permissions set to `600` (sufficient when the dynamic UID strategy from Phase 4 is followed — see Step 11)
- [ ] JSON validated (`python3 -m json.tool` — no errors)
- [ ] Gateway restarted successfully (`systemctl --user status openclaw-gateway` shows `active (running)`)
- [ ] Sandbox containers recreated (`openclaw sandbox recreate --all`)
- [ ] Test upload from SSH works — file appears in Google Drive
- [ ] Test upload from Telegram works — file appears in Google Drive
- [ ] Security audit: 0 critical; doctor: clean

## Troubleshooting

**`Failed to connect to user scope bus via local transport: Operation not permitted`:** You are not in a direct SSH session. Exit completely and reconnect with `ssh openclaw@<RASPBERRY_PI_IP>` or `ssh openclaw@openclaw-pi`. Never use `su openclaw` or `sudo su - openclaw`. See the "Critical: How to SSH In Correctly" section at the top.

**Tailscale SSH logs you in as root:** Specify the user explicitly: `ssh openclaw@openclaw-pi`. If this is rejected, check your Tailscale SSH ACLs in the Tailscale admin console.

**`sandbox recreate` confirmation prompt — can't select Yes:** Use the **left arrow key ←** to move the selection from No to Yes, then press **Enter**.

**`rclone: command not found` inside sandbox:** The sandbox is still using the old image. Run `openclaw sandbox recreate --all` (select Yes) and retry.

**`rclone copy` fails with "permission denied" inside sandbox:** The bind mount may not be working. Verify the `binds` path matches exactly: `/home/openclaw/.config/rclone:/home/claw/.config/rclone:ro`. The left side is the host path; the right side is the container path.

**OpenClaw says "rclone config exists but can't read it" or reports a UID/permission mismatch:** The container user's UID does not match the host `openclaw` user's UID. If you followed Phase 4's dynamic UID strategy, rebuild the sandbox image with the correct UID (see Step 11). As a quick workaround, run `chmod 644 ~/.config/rclone/rclone.conf` on the Pi — but rebuilding the image is the cleaner fix. Do **not** run `chown 1000:1000` as OpenClaw may suggest — that would change ownership away from the `openclaw` user on the host, which could cause different problems.

**`Failed to create file system for "openclaw-gdrive"` inside sandbox:** The rclone config isn't accessible. Check that the host path exists (`ls ~/.config/rclone/rclone.conf`) and that the bind mount uses `:ro`.

**Token paste step — browser shows "This app isn't verified":** This is normal for rclone. Click **Advanced** → **Go to rclone (unsafe)** → **Allow**.

**`rclone authorize` on laptop shows wrong version warning:** The Pi and laptop should ideally have the same rclone version. Minor version differences usually work fine. If authorisation fails, update rclone on both machines and retry.

**Files upload but Google Drive shows 0 bytes:** Network issue mid-transfer. Retry the upload. If persistent, check `docker.network` is set to `"bridge"` (not `"none"`).

---

*Phase 6.5 added to support document sharing via Google Drive. Verify against [official OpenClaw docs](https://docs.openclaw.ai) for any changes to sandbox bind mount syntax.*


# Phase 7 — Ongoing Maintenance & Monitoring

> Detailed walkthroughs for each item below are planned for a future update.
> This checklist covers the essentials.

## Maintenance Checklist

| Task | Frequency | How |
|---|---|---|
| Monitor API costs | Weekly | Log into [console.anthropic.com](https://console.anthropic.com) → Usage tab. Verify spending is within your configured limit. |
| Check OpenClaw logs | As needed | `openclaw logs --follow` or `journalctl --user -u openclaw-gateway -n 100` |
| Update OpenClaw | When notified | As the `openclaw` user: `npm update -g openclaw@latest`, then `systemctl --user restart openclaw-gateway` |
| Update Ollama models | Monthly | `ollama pull qwen3:1.7b` (re-pulls latest version). Repeat for each model. |
| Update the OS | Automatic | `unattended-upgrades` handles security patches. Verify: `sudo unattended-upgrades --dry-run` |
| Rotate Anthropic API key | Every 90 days | Generate a new key in the Anthropic Console. Update `~/.openclaw/openclaw.json`. Revoke the old key. Restart the gateway. |
| Rotate gateway auth token | Every 90 days | Stop the gateway. Edit `gateway.auth.token` in `openclaw.json`. Restart. Update the admin user's CLI config (`openclaw config set gateway.auth.token`). |
| Rotate GitHub PAT | On expiry (90 days) | Generate a new fine-grained token. Update `~/.openclaw/.env` (`GITHUB_TOKEN`) and `sandbox.docker.env.GITHUB_TOKEN` in `openclaw.json`. Update `~/.git-credentials`. Restart. |
| Re-run security audit | Monthly | `openclaw security audit --deep` — should show 0 critical. |
| Backup OpenClaw workspace | Weekly or after changes | `cd ~/.openclaw/workspace && git add -A && git commit -m "backup" && git push` |

## Incident Response

If something seems wrong — unexpected messages, unusual API charges,
OpenClaw behaving erratically — follow the OpenClaw Security docs'
incident response protocol:

1. **Stop the gateway immediately:** `systemctl --user stop openclaw-gateway`
2. **Rotate all secrets:** Anthropic API key, gateway token, GitHub PAT, Telegram bot token.
3. **Review logs:** `openclaw logs` and `journalctl --user -u openclaw-gateway`
4. **Re-run the security audit:** `openclaw security audit --deep`
5. **Restart only after** all secrets are rotated and the audit is clean.

# Phase 8: Tailscale Remote Access & Control UI Setup

Set up Tailscale to securely access the Raspberry Pi (SSH and OpenClaw Control UI) from any network — without switching WiFi or breaking network isolation.

## Prerequisites

Before starting this phase, you should have completed:

- **Network isolation**: The Raspberry Pi is on an isolated network (e.g., a GL.iNet travel router) separate from your main home WiFi.
- **Raspberry Pi OS hardened**: SSH (public-key only) configured, UFW firewall active with default-deny incoming, a dedicated admin user (`<ADMIN_USER>`) with `sudo` privileges, and a restricted user (`openclaw`) running the OpenClaw gateway — without `sudo`.
- **OpenClaw installed and running**: The gateway is operational and accessible via a messaging channel (e.g., Telegram). The gateway is bound to loopback (`127.0.0.1`) with token-based authentication.
- **Existing SSH access**: You can SSH into the Pi from the isolated network (e.g., `ssh <ADMIN_USER>@<RASPBERRY_PI_IP>` when connected to the GL.iNET WiFi).

### What you'll need

| Item | Purpose |
|------|---------|
| A laptop (macOS) on your normal home WiFi | Installing Tailscale client, accessing the Control UI |
| SSH access to the Pi via the isolated network | Installing Tailscale on the Pi (one last time) |
| An email address or SSO account (Google, Microsoft, GitHub, Apple) | Creating your Tailscale account |

### Key concepts

- **Tailscale** is a service that creates a private, encrypted overlay network (called a **tailnet**) connecting only your specific devices to each other — regardless of what physical network they're on. It uses [WireGuard](https://www.wireguard.com/) encryption and does not require opening any ports on your router.
- **Tailscale Serve** is a Tailscale feature that securely proxies a local service (like the OpenClaw gateway on `127.0.0.1`) so that other devices on your tailnet can access it via HTTPS.
- **MagicDNS** is Tailscale's built-in DNS feature that lets you reach devices by hostname (e.g., `openclaw-pi`) instead of IP address.
- **`<GATEWAY_PORT>`** refers to the OpenClaw gateway port configured in Phase 4. The default is **18789**. If you used a different port, substitute it wherever you see `<GATEWAY_PORT>` in this phase.

---

## Steps

### 1. Create a Tailscale account

**Where:** Your laptop, on your normal home WiFi. No need to touch the Pi yet.

1. Open your browser and go to [https://login.tailscale.com](https://login.tailscale.com).
2. Sign up using Google, Microsoft, GitHub, Apple, or email.
3. After signing in, you'll land on the **Tailscale admin console** — a dashboard showing all devices on your tailnet. It will be empty initially.
4. Note your **tailnet name**. It appears at the top of the admin console and looks like `tail1234.ts.net` or `your-name.github`. You'll need this later.

> **Why:** Your Tailscale account defines your tailnet. Only devices logged into *your* account can see each other. This is what keeps it secure.

> **Cost:** Tailscale's free "Personal" plan supports up to 100 devices and 3 users. This setup requires only 2 devices and 1 user.

---

### 2. Install Tailscale on the Raspberry Pi

**Where:** SSH into the Pi from the isolated network. This is the last time you'll need to switch WiFi for routine Pi management.

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

#### 2a. Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Downloads and runs Tailscale's official install script. It auto-detects Raspberry Pi OS (64-bit Debian) and installs the correct version.

**Expected output:** Package installation messages, finishing within 1–2 minutes.

> **Note — Kernel mismatch dialog:** If you see a message like *"Newer kernel available — The currently running kernel version is X which is not the expected kernel version Y"*, click **OK** to dismiss it. This means a system update installed a newer kernel that hasn't been loaded yet. We'll reboot after installation.

#### 2b. Reboot the Pi

After installation completes, reboot to load any pending kernel updates:

```bash
sudo reboot
```

Wait 30–60 seconds, then SSH back in:

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

#### 2c. Start Tailscale and authenticate

```bash
sudo tailscale up --ssh --hostname=openclaw-pi
```

| Flag | Purpose |
|------|---------|
| `--ssh` | Enables Tailscale SSH — lets you SSH into the Pi through Tailscale without needing traditional SSH keys. Authentication is handled by your Tailscale account identity. |
| `--hostname=openclaw-pi` | Gives the Pi a readable name on your tailnet instead of a random string. |

> **How Tailscale SSH relates to Phase 2b hardening:** Tailscale SSH uses
> your Tailscale account identity for authentication — not SSH keys or
> passwords. Connections via Tailscale bypass the traditional SSH daemon
> (and therefore bypass fail2ban and your sshd_config settings). This is
> secure because only devices authenticated on your personal Tailscale
> account can connect, but it is a different authentication path from the
> one hardened in Phase 2b. Both paths remain active: direct SSH on the
> isolated network uses your SSH keys + sshd_config; Tailscale SSH uses
> your Tailscale identity.

**Expected output:** A URL like:

```
To authenticate, visit:
    https://login.tailscale.com/a/abc123xyz
```

Copy this URL, open it in your laptop's browser, and log in with the same Tailscale account you just created. This authorizes the Pi to join your tailnet.

#### 2d. Verify Tailscale is connected

```bash
tailscale status
```

**Expected output:** Your Pi listed with a Tailscale IP address (format: `100.x.y.z`).

---

### 3. Install Tailscale on your Mac

**Where:** Your laptop. Switch back to your **normal home WiFi**.

1. Open the **App Store** on your Mac.
2. Search for **Tailscale**.
3. Download and install it (free).
4. Open the Tailscale app. A small icon appears in the **menu bar** (top-right of screen).
5. Click the icon → **Log in**. Sign in with the same Tailscale account.

---

### 4. Test Tailscale connectivity

**Where:** Your Mac's Terminal (Cmd+Space → type "Terminal"). Your Mac should be on your **normal home WiFi**; the Pi should be on the isolated network. They are on completely separate networks.

#### 4a. Verify both devices are visible

```bash
tailscale status
```

**Expected:** Both your Mac and `openclaw-pi` listed with `100.x.y.z` addresses.

#### 4b. Test network connectivity

```bash
ping openclaw-pi -c 4
```

Sends 4 test messages to the Pi via the Tailscale network.

**Expected:**

```
64 bytes from 100.x.y.z: icmp_seq=0 time=5.2 ms
64 bytes from 100.x.y.z: icmp_seq=1 time=4.8 ms
...
```

If you see replies, Tailscale networking is working.

#### 4c. Test SSH (this will likely fail — see next step)

```bash
ssh <ADMIN_USER>@openclaw-pi
```

**Expected:** This will probably time out or be refused. The Pi's UFW firewall only allows SSH from the specific IP address you configured during hardening. Tailscale connections arrive on a different interface (`tailscale0`) with a `100.x.y.z` address, which the firewall blocks. This is fixed in the next step.

---

### 5. Allow SSH through the firewall for Tailscale

**Where:** SSH into the Pi from the **isolated network** (the old way, one last time).

```bash
ssh <ADMIN_USER>@<RASPBERRY_PI_IP>
```

Add a firewall rule that permits SSH only on the Tailscale interface:

```bash
sudo ufw allow in on tailscale0 to any port 22 proto tcp comment "SSH via Tailscale"
```

| Part | Meaning |
|------|---------|
| `on tailscale0` | Only applies to the Tailscale virtual network interface. Traffic from your physical network or any other source is unaffected. |
| `to any port 22 proto tcp` | Allow SSH connections (port 22, TCP). |
| `comment "SSH via Tailscale"` | Labels the rule for future reference. |

> **Why this is safe:** The `tailscale0` interface only carries traffic from devices authenticated on your Tailscale account. Nobody else can reach it.

Verify the rule was added:

```bash
sudo ufw status verbose
```

**Expected:** Your existing rules plus the new Tailscale SSH rule:

```
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    <YOUR_LAPTOP_IP>           # SSH from laptop (isolated network)
22/tcp on tailscale0       ALLOW IN    Anywhere                   # SSH via Tailscale
22/tcp (v6) on tailscale0  ALLOW IN    Anywhere (v6)              # SSH via Tailscale
```

Now switch your Mac back to **normal home WiFi** and test:

```bash
ssh <ADMIN_USER>@openclaw-pi
```

**Expected:** Successful SSH login. You can now manage the Pi without switching WiFi networks.

---

### 6. Enable HTTPS and MagicDNS in the Tailscale admin console

**Where:** Your laptop's browser.

Tailscale Serve (which we'll set up next) requires both HTTPS certificates and MagicDNS to be enabled on your tailnet.

1. Go to [https://login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns).
2. Confirm **MagicDNS** is enabled. If not, toggle it on.
3. Find **HTTPS Certificates** and enable it.

> **About the certificate transparency warning:** When you enable HTTPS, Tailscale will show a notice that machine names (e.g., `openclaw-pi.tail1234.ts.net`) are recorded in a public certificate transparency log. This is standard for all HTTPS certificates across the internet. It reveals only that a device with that name exists — not your real name, IP address, location, or what the device does. No one can connect to your Pi using this information. It is safe to enable.

---

### 7. Set up Tailscale Serve (manual method)

**Where:** SSH into the Pi via Tailscale (from your normal home WiFi — no more switching!):

```bash
ssh <ADMIN_USER>@openclaw-pi
```

> ⚠️ **Deviation from official docs:** The OpenClaw documentation recommends setting `gateway.tailscale.mode: "serve"` in `openclaw.json` for automatic Tailscale Serve management. On this setup, the automatic method does not work because the `openclaw` user (which runs the gateway as a systemd user service) lacks the elevated permissions required to run `tailscale serve`. The manual approach below is used instead. This is functionally equivalent and avoids granting additional privileges to the restricted user.

First, confirm the gateway is running and responding locally:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:<GATEWAY_PORT>/
```

**Expected:** `200` (or `401` — either means the gateway is alive).

If the gateway is not running, start it:

```bash
sudo -u openclaw XDG_RUNTIME_DIR=/run/user/$(id -u openclaw) systemctl --user restart openclaw-gateway
```

Now set up Tailscale Serve:

```bash
sudo tailscale serve --bg http://127.0.0.1:<GATEWAY_PORT>
```

| Part | Meaning |
|------|---------|
| `sudo` | Tailscale Serve requires elevated permissions to configure. |
| `--bg` | Runs persistently in the background; survives reboots. |
| `http://127.0.0.1:<GATEWAY_PORT>` | Tells Tailscale to forward incoming HTTPS requests to the OpenClaw gateway on localhost. |

> ⚠️ **Important — use `http://`, not `https+insecure://`:** The gateway serves plain HTTP on localhost. Using `https+insecure://` causes a protocol mismatch that results in a `502 Bad Gateway` error. The `http://` prefix only affects the local hop on the Pi itself (Tailscale process → OpenClaw process, entirely in memory). The connection from your Mac to the Pi is fully encrypted by Tailscale's WireGuard tunnel regardless of this setting.

**Expected output:**

```
Available within your tailnet:

https://openclaw-pi.<YOUR_TAILNET_NAME>.ts.net/
|-- proxy http://127.0.0.1:<GATEWAY_PORT>

Serve started and running in the background.
To disable the proxy, run: tailscale serve --https=443 off
```

Verify:

```bash
tailscale serve status
```

**Expected:** An active serve config showing the proxy target.

---

### 8. Find your tailnet name (if you don't have it)

If you didn't note your tailnet name in Step 1, retrieve it from your Mac's terminal:

```bash
tailscale status --json | grep MagicDNSSuffix
```

**Expected output:**

```json
"MagicDNSSuffix": "<YOUR_TAILNET_NAME>.ts.net"
```

Alternatively, check [https://login.tailscale.com/admin](https://login.tailscale.com/admin) — the tailnet name is displayed at the top of the page.

---

### 9. Configure the admin user's CLI to connect to the gateway

**Where:** SSH session on the Pi (as the admin user).

The `openclaw` CLI installed under the admin user's home directory needs to know the gateway port and auth token to issue management commands (like approving device pairings).

#### 9-pre. Install the OpenClaw CLI for the admin user

The `openclaw` binary was installed under the `openclaw` user's home directory and is not in the admin user's `$PATH`. Install it for your admin user too:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g openclaw@latest
```

**Verify:**

```bash
openclaw --version
```

If you prefer not to install it twice, you can use the full path instead: `/home/openclaw/.npm-global/bin/openclaw`. For example: `/home/openclaw/.npm-global/bin/openclaw devices list`.

#### 9a. Find the gateway auth token

```bash
sudo grep '"token"' /home/openclaw/.openclaw/openclaw.json
```

Look for the line under the `gateway.auth` section (not the Telegram `botToken` or `GITHUB_TOKEN`). It will look like:

```
"token": "<YOUR_GATEWAY_TOKEN>"
```

#### 9b. Configure the CLI

```bash
openclaw config set gateway.port <GATEWAY_PORT>
openclaw config set gateway.auth.token "<YOUR_GATEWAY_TOKEN>"
```

> **Why:** The admin user has a separate config file (`/home/<ADMIN_USER>/.openclaw/openclaw.json`) from the gateway's config (`/home/openclaw/.openclaw/openclaw.json`). The CLI needs the port and token to authenticate with the running gateway over its local WebSocket.

Verify the CLI can now connect:

```bash
openclaw devices list
```

**Expected:** A list of pending and/or paired devices (possibly empty if no devices have connected yet).

---

### 10. Connect the Control UI and approve the device

**Where:** Your Mac's browser (on normal home WiFi).

#### 10a. Open the Control UI

Navigate to:

```
https://openclaw-pi.<YOUR_TAILNET_NAME>.ts.net/
```

#### 10b. Authenticate

The UI will show a **Gateway Token** input field. Paste the gateway auth token (the same one from Step 9a) and click **Connect**.

The UI will likely display: `disconnected (1008): pairing required`. This is expected — the gateway requires one-time device pairing approval for new connections.

#### 10c. Approve the device pairing

Back in your SSH session on the Pi:

```bash
openclaw devices list
```

You should see a pending pairing request from your browser. Note the `<requestId>`.

```bash
openclaw devices approve <requestId>
```

#### 10d. Restart the gateway and reconnect

```bash
sudo -u openclaw XDG_RUNTIME_DIR=/run/user/$(id -u openclaw) systemctl --user restart openclaw-gateway
```

Refresh the Control UI page in your browser. It should now show as connected.

---

### 11. Create convenience aliases

The gateway management command is long. Create shortcuts by adding aliases to your shell configuration:

```bash
echo 'alias oc-restart="sudo -u openclaw XDG_RUNTIME_DIR=/run/user/\$(id -u openclaw) systemctl --user restart openclaw-gateway"' >> ~/.bashrc
echo 'alias oc-status="sudo -u openclaw XDG_RUNTIME_DIR=/run/user/\$(id -u openclaw) systemctl --user status openclaw-gateway"' >> ~/.bashrc
echo 'alias oc-logs="sudo -u openclaw XDG_RUNTIME_DIR=/run/user/\$(id -u openclaw) journalctl --user -u openclaw-gateway -n 50 --no-pager"' >> ~/.bashrc
source ~/.bashrc
```

| Alias | Command |
|-------|---------|
| `oc-restart` | Restarts the OpenClaw gateway |
| `oc-status` | Checks if the gateway is running |
| `oc-logs` | Shows the last 50 lines of gateway logs |

Test:

```bash
oc-status
```

**Expected:** `active (running)` in the output.

> **Note on log permissions:** The `oc-logs` alias reads the openclaw user's systemd journal. If it returns `No journal files were opened due to insufficient permissions`, the admin user may not have access to the openclaw user's journal. As a workaround, use: `sudo journalctl _UID=$(id -u openclaw) -n 50 --no-pager`

---

## Verification

Confirm the following from your Mac on your **normal home WiFi** (not the isolated network):

| Test | Command / Action | Expected Result |
|------|-----------------|-----------------|
| Tailscale status | `tailscale status` (Mac terminal) | Both Mac and `openclaw-pi` listed |
| SSH via Tailscale | `ssh <ADMIN_USER>@openclaw-pi` | Successful login |
| Tailscale Serve active | `tailscale serve status` (Pi terminal) | Proxy config shown |
| Control UI accessible | Open `https://openclaw-pi.<YOUR_TAILNET_NAME>.ts.net/` | UI loads and shows "connected" |
| Gateway health | `oc-status` (Pi terminal) | `active (running)` |
| Network isolation intact | From Mac on home WiFi, try `ping <RASPBERRY_PI_IP>` (the GL.iNet IP) | **Should fail** — isolation is working |

---

## Access summary

After completing this phase, your access model is:

| Location | Method | Works? |
|----------|--------|--------|
| Home WiFi | `ssh <ADMIN_USER>@openclaw-pi` (Tailscale) | ✅ |
| Isolated network (GL.iNET) | `ssh <ADMIN_USER>@<RASPBERRY_PI_IP>` (direct) | ✅ |
| Coffee shop, hotel, anywhere with internet | `ssh <ADMIN_USER>@openclaw-pi` (Tailscale) | ✅ |
| Any network (browser) | `https://openclaw-pi.<YOUR_TAILNET_NAME>.ts.net/` | ✅ |
| Telegram (phone) | Send messages to the OpenClaw bot | ✅ (unchanged) |

---

## Troubleshooting

### SSH via Tailscale times out or is refused

**Cause:** The Pi's UFW firewall is blocking connections on the `tailscale0` interface.

**Fix:** Connect via the isolated network and add the firewall rule:

```bash
sudo ufw allow in on tailscale0 to any port 22 proto tcp comment "SSH via Tailscale"
```

---

### Control UI shows `ERR_CONNECTION_REFUSED`

**Cause:** Tailscale Serve is not running.

**Fix:** SSH into the Pi and start it manually:

```bash
sudo tailscale serve --bg http://127.0.0.1:<GATEWAY_PORT>
```

Also verify that **MagicDNS** and **HTTPS Certificates** are both enabled at [https://login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns).

---

### Control UI shows `HTTP ERROR 502`

**Cause:** Protocol mismatch — Tailscale Serve is connecting to the gateway using the wrong protocol.

**Fix:** Reset and reconfigure with `http://` (not `https+insecure://`):

```bash
sudo tailscale serve --https=443 off
sudo tailscale serve --bg http://127.0.0.1:<GATEWAY_PORT>
```

---

### Control UI shows `disconnected (1008): pairing required`

**Cause:** The browser is a new device that hasn't been approved by the gateway yet.

**Fix:**

1. Make sure you've entered the gateway token in the Control UI's token field.
2. In your SSH session:

```bash
openclaw devices list
openclaw devices approve <requestId>
```

3. Restart the gateway and refresh the browser:

```bash
oc-restart
```

---

### `openclaw devices list` fails with `unauthorized: gateway token missing`

**Cause:** The admin user's CLI config is missing the gateway port and/or auth token.

**Fix:**

```bash
openclaw config set gateway.port <GATEWAY_PORT>
openclaw config set gateway.auth.token "<YOUR_GATEWAY_TOKEN>"
```

Find the token with:

```bash
sudo grep '"token"' /home/openclaw/.openclaw/openclaw.json
```

---

### `sudo -u openclaw openclaw ...` fails with `Permission denied`

**Cause:** OpenClaw was installed under the admin user's home directory. The restricted `openclaw` user cannot access binaries in another user's home directory (by design).

**Fix:** Run `openclaw` CLI commands as the admin user, not as the openclaw user. The CLI connects to the gateway over the local WebSocket — it doesn't need to run as the same user that owns the gateway process.

---

### Kernel mismatch warning during Tailscale installation

**Cause:** A system update installed a newer kernel that hasn't been loaded yet.

**Fix:** Click OK to dismiss, then reboot the Pi after Tailscale installation completes:

```bash
sudo reboot
```

