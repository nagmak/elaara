# Quick Start Guide

## Initial Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up API Keys

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

**Get your API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Meeting Recording

1. **Allow Microphone Access**: When prompted, click "Allow" to grant microphone permissions

2. **Start Recording**: Click the red record button

3. **Stop & Save**: Click "Stop & Save" when finished

4. **Wait for Transcription**: The app will automatically transcribe your recording (takes ~1-2 minutes for a 10-minute meeting)

5. **View Transcript**: Once complete, you'll be redirected to the meeting detail page

6. **Generate Summary** (Optional):
   - Click the "Summary" tab
   - Click "Generate Summary"
   - Wait ~30 seconds for AI processing

## Key Features

- **100% Local Storage**: All data stored in your browser
- **Privacy First**: Recordings never leave your device (except for API processing)
- **Cost Optimized**: Smart preprocessing reduces AI costs by 50%+
- **Export Anytime**: Download meetings as ZIP files for backup

## Cost Expectations

- **Transcription**: $0.006/minute (~$0.36/hour)
- **Summarization**: $0.01-$0.05 per meeting
- **Typical Monthly**: $5-15 for regular users

## Troubleshooting

**Microphone not working?**
- Check browser permissions
- Ensure no other app is using the microphone
- Try reloading the page

**Build failed?**
```bash
rm -rf .next node_modules
npm install
npm run build
```

**Storage full?**
- Go to Settings > Storage
- Archive old meetings
- Export and delete archived meetings

## Production Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

```bash
# Or build locally
npm run build
npm start
```

## Browser Support

✅ Chrome (Recommended)
✅ Edge
✅ Firefox
⚠️ Safari (Limited support)

## Next Steps

1. Record your first meeting
2. Explore the dashboard
3. Try generating a summary
4. Export a meeting as backup
5. Customize settings (dark mode, auto-archive, etc.)

---

**Need help?** Check the [README.md](README.md) for detailed documentation.
