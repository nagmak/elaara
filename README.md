# Elaara - Meeting Transcription & Summarization

A powerful, privacy-first web application for recording, transcribing, and summarizing meetings using AI. All data is stored locally in your browser for maximum privacy and zero hosting costs.

## Features

- **Audio Recording**: Record meetings directly from your browser with real-time audio visualization
- **AI Transcription**: Automatic transcription using OpenAI Whisper API with timestamps
- **AI Summarization**: Generate structured summaries using Claude API (Haiku model for cost optimization)
- **Local Storage**: All data stored in browser IndexedDB - your recordings never leave your device
- **Export/Import**: Backup and restore your meetings as ZIP files
- **Privacy-First**: No backend database, no cloud storage, complete privacy
- **Cost Optimized**: Smart preprocessing and prompt caching reduce AI costs by 50%+
- **Dark Mode**: Beautiful dark mode support
- **Archive Feature**: Save space by archiving old meetings (keeps transcripts, removes audio)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB via `idb` library
- **Transcription**: OpenAI Whisper API
- **Summarization**: Anthropic Claude API (Haiku model)
- **Audio**: Browser MediaRecorder API
- **Export**: JSZip for ZIP file generation

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- OpenAI API key (for transcription)
- Anthropic API key (for summarization)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/elaara.git
cd elaara
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```env
# OpenAI API Key (for Whisper transcription)
OPENAI_API_KEY=sk-...

# Anthropic API Key (for Claude summarization)
ANTHROPIC_API_KEY=sk-ant-...
```

To get your API keys:
- **OpenAI**: Visit https://platform.openai.com/api-keys
- **Anthropic**: Visit https://console.anthropic.com/

4. **Run the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

### Deploying to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy!

## Usage Guide

### Recording a Meeting

1. Click "New Recording" or navigate to the Record page
2. Grant microphone permissions when prompted
3. Click the red record button to start
4. Use Pause/Resume as needed
5. Click "Stop & Save" when finished
6. Wait for automatic transcription (this may take a few minutes)

### Viewing Meetings

- **Dashboard**: View all your meetings in a card layout
- **Search**: Search across meeting titles, transcripts, and tags
- **Click a meeting**: View full details, transcript, and summary

### Generating Summaries

1. Open a meeting detail page
2. Click on the "Summary" tab
3. Click "Generate Summary"
4. Wait for AI processing (~10-30 seconds)
5. View structured summary with executive summary, key points, action items, decisions, and open questions

### Exporting Data

**Single Meeting Export:**
- Open meeting detail page
- Click "Export" button
- Downloads ZIP with audio, transcript, summary, and metadata

**Bulk Export:**
- Go to Settings
- Click "Export All Meetings"
- Downloads comprehensive ZIP of all meetings

### Storage Management

- View storage usage in Settings page
- Archive old meetings to save space (keeps transcript/summary, removes audio)
- Set up auto-archive for meetings older than X days
- Export important meetings regularly as backup

## Cost Information

Typical usage costs:

- **Transcription**: $0.006 per minute ($0.36 per hour)
- **Summarization**: $0.01 - $0.05 per meeting (depending on length)
- **Average Monthly Cost**: $5-15 for regular users

Cost optimizations included:
- Uses Claude Haiku (lowest cost Claude model)
- Prompt caching reduces costs by ~50%
- Smart transcript preprocessing reduces token count by 30-40%

## Browser Compatibility

- **Chrome**: ✅ Full support (recommended)
- **Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ⚠️ May have audio recording limitations

## Privacy & Data

- **All data stored locally** in your browser's IndexedDB
- Recordings never leave your device unless you export them
- API calls only send audio/text for processing, nothing is stored on servers
- Clearing browser data will permanently delete all recordings
- **Recommendation**: Export important meetings regularly for backup

## Troubleshooting

### Microphone Access Denied

- Check browser permissions for microphone access
- On Chrome: chrome://settings/content/microphone
- Make sure no other app is using the microphone

### Transcription Failed

- Check your OpenAI API key is valid
- Ensure you have credits in your OpenAI account
- Audio files larger than 25MB are automatically chunked
- Try recording in a shorter duration

### Summarization Failed

- Check your Anthropic API key is valid
- Ensure you have credits in your Anthropic account
- Try regenerating the summary

### Storage Full

- Archive old meetings to free up space
- Delete meetings you no longer need
- Export and delete archived meetings
- Browser storage quota typically 10GB-100GB depending on browser

### Build Errors

If you encounter build errors:

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
rm package-lock.json
npm install

# Try building again
npm run build
```

## Development

### Project Structure

```
elaara/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (transcribe, summarize)
│   ├── meeting/[id]/      # Meeting detail page
│   ├── record/            # Recording page
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── MeetingCard.tsx
│   └── Navigation.tsx
├── hooks/                 # Custom React hooks
│   ├── useMeetings.ts
│   ├── useRecorder.ts
│   ├── useStorage.ts
│   └── useToast.tsx
├── lib/                   # Utility libraries
│   ├── audio.ts          # Audio recording utilities
│   ├── claude.ts         # Claude API client
│   ├── costs.ts          # Cost tracking
│   ├── db.ts             # IndexedDB wrapper
│   ├── export.ts         # Export/import functionality
│   ├── preprocessing.ts  # Transcript preprocessing
│   ├── types.ts          # TypeScript types
│   ├── utils.ts          # Utility functions
│   └── whisper.ts        # Whisper API client
└── package.json
```

### Adding New Features

1. **New Component**: Add to `components/` directory
2. **New Page**: Add to `app/` directory
3. **New Utility**: Add to `lib/` directory
4. **New Hook**: Add to `hooks/` directory

### Testing Locally

```bash
# Run development server
npm run dev

# Build production version
npm run build

# Run production build locally
npm start

# Lint code
npm run lint
```

## Roadmap

Future enhancements:

- [ ] Speaker diarization improvements
- [ ] Support for video recording
- [ ] Multiple language support
- [ ] Custom summary templates
- [ ] Integration with calendar apps
- [ ] Cloud sync option (optional)
- [ ] Mobile app version
- [ ] Voice commands during recording

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for the Whisper API
- Anthropic for the Claude API
- Next.js team for the amazing framework
- All open source contributors

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with privacy in mind. Your meetings, your data, your device.**
