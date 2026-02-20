# OpenClaw on Raspberry Pi 5 — Security-First Installation Guide

A step-by-step guide to installing and configuring [OpenClaw](https://docs.openclaw.ai) on a Raspberry Pi 5, written for beginners who want to run an autonomous AI agent **without compromising their home network**.

## Why a strict installation?

OpenClaw is powerful — it can execute shell commands, read and write files, browse the web, and interact with external services. That power comes with real risk. A misconfigured agent could be exploited through prompt injection, malicious skills, or misconfiguration, potentially exposing your home network and personal devices.

This guide follows an **assume-breach** security posture: we design the setup so that even if OpenClaw is compromised, the blast radius is contained to the Raspberry Pi and cannot reach your personal devices, accounts, or data. Every step prioritises isolation, least privilege, and defence in depth.

## 🤖 Maintained by OpenClaw

This repository is monitored by an OpenClaw instance running on the setup described in this guide. It watches for issues, suggests fixes, and submits pull requests — so you're reading documentation that an AI agent helps keep accurate and up to date.
