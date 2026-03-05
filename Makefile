SHELL := /usr/bin/env bash

TARGETS ?= all
COMPOSE ?= docker compose
SERVICES := claude gemini opencode devstral auggie copilot codex

.PHONY: help list doctor images env build push release

help:
	@cat <<'EOF'
Usage:
  make list
  make doctor
  make images [TARGETS="all|target..."]
  make env
  make build [TARGETS="all|target..."]
  make push [TARGETS="all|target..."]
  make release [TARGETS="all|target..."]

Targets:
  claude gemini opencode devstral auggie copilot codex

Environment overrides:
  IMAGE_TAG        Tag to build/push (default: latest)
  AGENT_NAMESPACE  Namespace for agent images (default: vibepod)
  CLAUDE_CODE_CHANNEL Claude installer channel for docker/claude (default: latest)
EOF

list:
	@$(COMPOSE) config --services

doctor:
	@command -v docker >/dev/null 2>&1 || { echo "Error: docker is not installed or not in PATH" >&2; exit 1; }
	@$(COMPOSE) version >/dev/null
	@$(COMPOSE) config >/dev/null
	@echo "OK: compose configuration is valid"

images:
	@set -euo pipefail; \
	services="$(TARGETS)"; \
	if [[ "$$services" == "all" ]]; then services="$(SERVICES)"; fi; \
	agent_ns="$${AGENT_NAMESPACE:-vibepod}"; \
	image_tag="$${IMAGE_TAG:-latest}"; \
	for target in $$services; do \
		case "$$target" in \
			claude) image="$${agent_ns}/claude:$${image_tag}" ;; \
			gemini) image="$${agent_ns}/gemini:$${image_tag}" ;; \
			opencode) image="$${agent_ns}/opencode:$${image_tag}" ;; \
			devstral) image="$${agent_ns}/devstral:$${image_tag}" ;; \
			auggie) image="$${agent_ns}/auggie:$${image_tag}" ;; \
			copilot) image="$${agent_ns}/copilot:$${image_tag}" ;; \
			codex) image="$${agent_ns}/codex:$${image_tag}" ;; \
			*) echo "Error: Unknown target '$$target'" >&2; exit 1 ;; \
		esac; \
		echo "$$target=$$image"; \
	done

env:
	@set -euo pipefail; \
	agent_ns="$${AGENT_NAMESPACE:-vibepod}"; \
	image_tag="$${IMAGE_TAG:-latest}"; \
	echo "export VP_IMAGE_CLAUDE=\"$$agent_ns/claude:$$image_tag\""; \
	echo "export VP_IMAGE_GEMINI=\"$$agent_ns/gemini:$$image_tag\""; \
	echo "export VP_IMAGE_OPENCODE=\"$$agent_ns/opencode:$$image_tag\""; \
	echo "export VP_IMAGE_DEVSTRAL=\"$$agent_ns/devstral:$$image_tag\""; \
	echo "export VP_IMAGE_AUGGIE=\"$$agent_ns/auggie:$$image_tag\""; \
	echo "export VP_IMAGE_COPILOT=\"$$agent_ns/copilot:$$image_tag\""; \
	echo "export VP_IMAGE_CODEX=\"$$agent_ns/codex:$$image_tag\""

build:
	@set -euo pipefail; \
	services="$(TARGETS)"; \
	if [[ "$$services" == "all" ]]; then \
		$(COMPOSE) build $(SERVICES); \
	else \
		$(COMPOSE) build $$services; \
	fi

push:
	@set -euo pipefail; \
	services="$(TARGETS)"; \
	if [[ "$$services" == "all" ]]; then \
		$(COMPOSE) push $(SERVICES); \
	else \
		$(COMPOSE) push $$services; \
	fi

release:
	@$(MAKE) build TARGETS="$(TARGETS)"
	@$(MAKE) push TARGETS="$(TARGETS)"
