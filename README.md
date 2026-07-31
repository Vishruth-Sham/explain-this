# Explain This

Select text on any page and get it explained right where you're reading — by the AI model built into Chrome, running on your own machine.

No server. No account. Nothing you read is uploaded.

## What it does

Highlight a sentence you don't follow. A small button appears next to it; click it and the explanation writes itself out in a panel, a few words at a time.

It reads the paragraphs around your selection first, so words like *this* and *the above* resolve to the right thing. When that isn't enough context, **Explain deeper** takes in the whole article and tries again. If it still can't tell, it says so instead of guessing.

Drag the panel by its header to move it out of your way.

## Install

[Install Explain This from the Chrome Web Store](https://chromewebstore.google.com/detail/explain-this/alfhleejllgfalccldadlfpkppengman).

## Before you start

You need Chrome 138 or newer, on Windows 10/11, macOS 13+, Linux, or ChromeOS. Chrome also checks the machine can run a model at all: a graphics card with more than 4 GB of memory, or 16 GB of RAM and four CPU cores.

The first explanation triggers a one-time download that takes a few minutes. Until it finishes, the panel says so rather than sitting there spinning.

Chrome won't start that download unless the drive holding your Chrome profile has **22 GB free**. That's headroom it insists on, not the size of the model — the model is far smaller, and `chrome://on-device-internals` will show you what's actually stored. Worth knowing: if your free space later falls below 10 GB, Chrome deletes the model and fetches it again once there's room.

## Privacy

The model runs inside Chrome on your machine. The extension makes no network requests at all — what you select, and the page it came from, never leave your browser.

## Development

Plain JavaScript in `extension/`. No dependencies, no build step.

```bash
node --test extension/*.test.mjs
```
