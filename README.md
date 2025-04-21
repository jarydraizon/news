# Gmail Monitor and Summarizer

A Node.js application that monitors a Gmail inbox, processes emails using LLMs, and generates daily topic-based summaries.

## Features

- **Gmail Integration**: Connects to Gmail API to monitor and fetch emails
- **LLM-Powered Summaries**: Generates intelligent summaries using OpenAI's API
- **Topic Categorization**: Organizes emails by topic categories
- **Daily Digests**: Creates and distributes daily email summaries
- **REST API**: Provides endpoints for monitoring and controlling the application

## Architecture

The application follows a modular architecture:

- **Authentication Module**: Google OAuth for Gmail access
- **Email Fetcher**: Retrieves and processes emails from Gmail
- **Content Processor**: Extracts and normalizes email content
- **Summarization Engine**: Uses LLMs to create meaningful summaries
- **Notification System**: Distributes summaries via email

## Installation

### Prerequisites

- Node.js (v14+)
- MongoDB
- Gmail API credentials
- OpenAI API key

### Setup

1. Clone the repository
   ```
   git clone https://github.com/yourusername/gmail-monitor-summarizer.git
   cd gmail-monitor-summarizer
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create and configure environment variables
   ```
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

4. Set up Google API Credentials
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs (e.g., `http://localhost:3000/api/auth/google/callback`)

5. Authenticate with Gmail
   ```
   npm run setup-auth
   ```
   This will guide you through the authentication process and provide a refresh token to add to your `.env` file.

## Usage

### Starting the Server

```
npm run dev # Development mode with auto-reload
```

or

```
npm start # Production mode
```

### Command-line Tools

The application provides several command-line tools to help manage emails and summaries:

#### Fetch Emails from Gmail
```
npm run fetch-emails [-- --options]
```
Options:
- `--maxResults=<number>`: Maximum number of emails to fetch (default: 100)
- `--query=<string>`: Gmail search query
- `--daysBack=<number>`: Fetch emails from the last N days

#### Generate Email Summary
```
npm run generate-summary [-- --options]
```
Options:
- `--date=<YYYY-MM-DD>`: Date for which to generate summary (default: yesterday)
- `--distribute=<true|false>`: Whether to distribute the summary via email

### Authentication

1. Open your browser and navigate to:
   ```
   http://localhost:3000/api/auth/google
   ```

2. Follow the Google OAuth flow to grant access
3. After successful authentication, a refresh token will be displayed
4. Add this refresh token to your `.env` file

### API Endpoints

#### Authentication
- `GET /api/auth/google` - Initiate Gmail authentication
- `GET /api/auth/status` - Check authentication status

#### Emails
- `POST /api/emails/fetch` - Fetch new emails
- `GET /api/emails` - List emails with filtering and pagination
- `GET /api/emails/stats` - Get email statistics

#### Summaries
- `GET /api/summaries` - List generated summaries
- `POST /api/summaries/generate` - Generate a summary for a specific date
- `POST /api/summaries/job/run` - Manually trigger the summary job

## Schedule Configuration

By default, the application generates summaries daily at midnight. You can modify the schedule in the `.env` file:

```
SUMMARY_SCHEDULE="0 0 * * *" # Daily at midnight (cron format)
```

## Testing

The application includes comprehensive unit tests for models, services, and API endpoints. The test suite uses:

- Jest as the test runner
- MongoDB Memory Server for database testing
- Supertest for API testing
- Mocks for external services like Gmail API and OpenAI

### Running Tests

To run the test suite:

```
npm test
```

To run tests with coverage report:

```
npm run test:coverage
```

To run tests in watch mode during development:

```
npm run test:watch
```

### Test Structure

Tests are organized by component type:

- `src/tests/unit/models/` - Tests for database models
- `src/tests/unit/services/` - Tests for service components
- `src/tests/unit/routes/` - Tests for API endpoints
- `src/tests/unit/config/` - Tests for configuration modules

### Test Environment

Tests use a separate environment configuration defined in `.env.test`. This ensures that tests don't interact with production systems.

## Extending the Application

You can add new capabilities through the modular architecture:

- Add new LLM providers in the `src/config` directory
- Implement additional email processing functions in `src/services/emailService.js`
- Create new API endpoints in the `src/routes` directory

## License

MIT