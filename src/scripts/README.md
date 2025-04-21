# Gmail Monitor and Summarizer Scripts

This directory contains utility scripts for the Gmail Monitor and Summarizer application.

## Setup Authentication (setupAuth.js)

This script walks you through the Google OAuth flow to obtain the necessary tokens for accessing Gmail.

```
npm run setup-auth
```

The script will:
1. Open a browser window for Google authentication
2. Ask you to authenticate and grant permissions
3. Retrieve and save the tokens
4. Display the refresh token to add to your `.env` file

## Fetch Emails (fetchEmails.js)

This script fetches emails from Gmail and stores them in the database.

```
npm run fetch-emails
```

### Options:

You can pass various options to the script:

- `--maxResults=<number>`: Maximum number of emails to fetch (default: 100)
- `--query=<string>`: Gmail search query (e.g., "from:example@gmail.com")
- `--daysBack=<number>`: Fetch emails from the last N days

Examples:

```bash
# Fetch latest 10 emails
npm run fetch-emails -- --maxResults=10

# Fetch emails from a specific sender
npm run fetch-emails -- --query="from:newsletter@example.com"

# Fetch emails from the last 7 days
npm run fetch-emails -- --daysBack=7

# Combine multiple parameters
npm run fetch-emails -- --maxResults=50 --query="label:important" --daysBack=30
```

## Generate Summary (generateSummary.js)

This script generates a summary for emails on a specific date.

```
npm run generate-summary
```

### Options:

- `--date=<YYYY-MM-DD>`: Date for which to generate summary (default: yesterday)
- `--distribute=<true|false>`: Whether to distribute the summary via email (default: false)

Examples:

```bash
# Generate summary for yesterday (default)
npm run generate-summary

# Generate summary for a specific date
npm run generate-summary -- --date=2023-11-15

# Generate and distribute summary
npm run generate-summary -- --date=2023-11-15 --distribute=true
``` 