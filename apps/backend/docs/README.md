# Documentation

This directory contains documentation for the Pathfinder Helper project.

## Contents

### /prompts
Version-controlled system prompts for the AI chatbot.

- **chat-system-prompt.md**: The main system prompt used for the RAG chatbot
  - Defines the chatbot's behavior and responsibilities
  - Specifies how to handle RAW vs Campaign modes
  - Sets guidelines for citations and uncertainty handling
  - Version controlled to track improvements over time

## Why Version Control Prompts?

Prompt engineering is critical for AI application quality. By version controlling prompts:
- Track what changes improve/degrade performance
- A/B test different prompt strategies
- Collaborate on prompt improvements
- Roll back if changes reduce quality
- Document the reasoning behind prompt decisions

## Updating Prompts

When updating the chat system prompt:
1. Update the version number and date
2. Test with the standard test set of questions
3. Document what changed and why
4. Commit with a descriptive message explaining the improvement
