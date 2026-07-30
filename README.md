# Explain This

Select text on any page and get it explained right where you're reading — by the AI model built into Chrome, running on your own machine.

No server. No account. Nothing you read is uploaded.

## What it does

Highlight a sentence you don't follow. A small button appears next to it; click it and the explanation writes itself out in a panel, a few words at a time.

It reads the paragraphs around your selection first, so words like *this* and *the above* resolve to the right thing. When that isn't enough context, **Explain deeper** takes in the whole article and tries again. If it still can't tell, it says so instead of guessing.

Drag the panel by its header to move it out of your way.

## Install

Not on the Chrome Web Store yet, so load it from source:

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose the `extension` folder.
5. Reload any tabs you already had open.

## Before you start

You need Chrome 138 or newer, on Windows 10/11, macOS 13+, Linux, or ChromeOS.

The first explanation triggers a one-time model download that takes a few minutes. Chrome keeps the model on the drive holding your profile and wants roughly 22 GB free to do it. Until it's ready, the panel tells you it's still downloading rather than sitting there spinning.

## Privacy

The model runs inside Chrome on your machine. The extension makes no network requests at all — what you select, and the page it came from, never leave your browser.

## Development

Plain JavaScript in `extension/`. No dependencies, no build step.

```bash
node --test extension/*.test.mjs
```
