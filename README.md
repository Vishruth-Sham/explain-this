<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->
<!-- Hallmark · genre: editorial · macrostructure: Long Document · theme: Studio · enrichment: existing brand assets · platform: GitHub Markdown -->

<img align="right" src="./extension/assets/icon-128.png" width="112" height="112" alt="Explain This extension icon">

# Explain This

**Select text. Understand it.**

Context-aware explanations from the AI model built into Chrome.<br>
No server. No account. Nothing you read is uploaded.

<a href="https://chromewebstore.google.com/detail/explain-this/alfhleejllgfalccldadlfpkppengman">
  <img src="https://img.shields.io/badge/Install-Chrome_Web_Store-4285F4?style=for-the-badge&amp;logo=googlechrome&amp;logoColor=white" alt="Install Explain This from the Chrome Web Store">
</a>

<br clear="right">

## Read without leaving the page

Explain This turns a difficult sentence into a clear explanation right where you found it. Highlight a passage, click the small button beside it, and the answer streams into a movable panel over the page.

1. **Select** a sentence, term, error message, or piece of code.
2. **Explain** it using the nearby paragraphs, section heading, and page context.
3. **Go deeper** when the local context is not enough; the extension can read the main article and try again.

The extension keeps the exact selection separate from its context, so it explains what you highlighted instead of drifting into the page title or section heading.

## Before first use

Explain This uses Chrome’s built-in on-device language model. The first explanation may trigger a one-time model download; while it downloads, the panel tells you to try again shortly.

| Requirement | Minimum |
| --- | --- |
| Chrome | Version 138 or newer |
| Operating system | Windows 10/11, macOS 13+, Linux, or ChromeOS |
| Hardware | More than 4 GB of graphics memory, or 16 GB of RAM and four CPU cores |
| Free space | 22 GB on the drive containing the Chrome profile |

The disk requirement is Chrome’s download headroom, not the model’s final size. If available space later falls below 10 GB, Chrome may remove the model and download it again when enough room is available. Model status is visible at `chrome://on-device-internals`.

## Private by construction

Selected text and page context are passed directly to Chrome’s on-device model and held only for the current explanation.

- The extension makes no network requests.
- It has no server, account system, analytics, telemetry, advertising, or error reporting.
- It does not write selections or explanations to disk.
- Nothing is shared with the developer or a third party.

[Read the complete privacy policy](./PRIVACY.md).

## Development

The extension is plain JavaScript: no runtime dependencies, no build step, and no remotely loaded code.

```sh
npm test
```

| Path | Purpose |
| --- | --- |
| `extension/content.js` | Selection capture, context extraction, and in-page interface |
| `extension/background.js` | On-device model session and streamed explanations |
| `extension/promptLogic.js` | Input validation and prompt construction |
| `extension/prompts.js` | Quick and deep explanation prompts |
| `package.sh` | Chrome Web Store package assembly |

Run `./package.sh` to rebuild the store ZIP from the current extension source.
