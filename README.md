# Talk to your Repo

An intelligent code assistant that enables natural language conversations with GitHub repositories. Simply provide a GitHub repository URL, and the system will process the codebase to allow you to ask questions, understand functionality, and explore the code through an intuitive chat interface.

## Features

- **Repository Processing**: Automatically clones and indexes GitHub repositories
- **Intelligent Code Analysis**: Uses advanced AI embeddings to understand code semantics
- **Natural Language Queries**: Ask questions about code functionality, structure, and implementation
- **Source Citations**: Get precise file references with line numbers for all responses
- **File Tree Visualization**: Browse the repository structure directly in the interface
- **Real-time Processing**: Monitor repository processing status with live updates
- **Conversation History**: Maintain context across multiple questions about the same repository

## Architecture

### Backend
- **FastAPI** framework for high-performance API endpoints
- **Google Gemini AI** for code embeddings and response generation
- **Vector Similarity Search** for finding relevant code chunks
- **Repository Processing** with intelligent file filtering and chunking
- **In-memory Storage** for development (easily extensible to database solutions)

### Frontend
- **React** application with modern JavaScript
- **Responsive Design** optimized for developer workflows
- **Real-time Status Updates** during repository processing
- **Interactive Chat Interface** with message history
- **Source Reference Display** for code citations

## Prerequisites

- Python 3.11+
- Node.js 16+
- Git (for repository cloning)
- Google Gemini API key

## Installation

### Backend Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd talk-to-repo
```

2. Navigate to the backend directory:
```bash
cd backend
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `GEMINI_MODEL`: Model to use (default: "gemini-2.0-flash")

5. Start the backend server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Docker Deployment

### Backend Docker

1. Build the Docker image:
```bash
cd backend
docker build -t talk-to-repo-backend .
```

2. Run the container:
```bash
docker run -p 8000:8000 -e GEMINI_API_KEY=your_api_key talk-to-repo-backend
```

### Full Stack Deployment

For production deployment, consider using Docker Compose to orchestrate both frontend and backend services.

## API Documentation

Once the backend is running, visit `http://localhost:8000/docs` for interactive API documentation.

### Key Endpoints

- `POST /api/repos/process` - Process a new GitHub repository
- `GET /api/repos/{repo_id}/status` - Check processing status
- `POST /api/chat` - Send a message to chat with the repository
- `GET /api/repos/{repo_id}/files` - Get repository file tree
- `GET /health` - Health check endpoint

## Usage

1. **Process Repository**: Enter a GitHub repository URL in the interface
2. **Wait for Processing**: Monitor the progress as the system analyzes the codebase
3. **Start Chatting**: Once processing is complete, ask questions about the code
4. **Explore Sources**: Click on cited sources to understand where answers come from
5. **Browse Files**: Use the file tree to explore the repository structure

### Example Questions

- "What is the main purpose of this application?"
- "How does the authentication system work?"
- "Show me the database schema"
- "What are the main API endpoints?"
- "How is error handling implemented?"
- "What testing frameworks are used?"

## Configuration

### File Processing

The system intelligently filters files to process only relevant code files while skipping:
- Binary files and images
- Large data files
- Auto-generated files
- Common build artifacts
- Dependency directories (node_modules, etc.)

### Chunking Strategy

Code files are split into logical chunks based on:
- Function and class boundaries
- File size considerations
- Semantic relevance
- Maximum chunk size limits

## Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Development

```bash
cd frontend
npm start
```

### Running Tests

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Implement proper rate limiting for production deployment
- Consider authentication and authorization for multi-user scenarios
- Validate and sanitize all user inputs

## Performance Optimization

- Repository processing time depends on codebase size
- Embedding generation is batched for efficiency
- Consider implementing caching for frequently accessed repositories
- Monitor memory usage for large repositories

## Troubleshooting

### Common Issues

**Repository Processing Fails**
- Verify the GitHub URL is accessible
- Check if the repository requires authentication
- Ensure sufficient disk space for cloning

**API Connection Issues**
- Verify Gemini API key is correctly configured
- Check network connectivity to Google's services
- Review API usage limits and quotas

**Frontend Not Connecting to Backend**
- Ensure backend is running on port 8000
- Check CORS configuration
- Verify API endpoint URLs

## Acknowledgments

- Google Gemini AI for powerful language understanding
- FastAPI for excellent API framework
- React community for frontend tools and libraries
- Open source contributors and maintainers