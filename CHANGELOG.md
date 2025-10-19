# Changelog

All notable changes to Apilot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0-beta.1] - 2025-01-19

### Added
- **Cancel Generation**: Stop button to abort AI test generation mid-stream via IPC
  - Implemented AbortController in electron main process
  - Added cancel-generation IPC handler
  - Updated UI with functional Stop button during generation
- **Endpoint Editing**: Enhanced endpoint editing capabilities in EndpointEditor component
- **Field Editing**: Improved FieldEditor for request/response editing

### Changed
- **AI Service Architecture**: Improved streaming and abort handling in OpenAI service
- **Generation Continuation**: Enhanced metadata tracking for token limit continuation
  - Complete corrupted tests instead of ignoring them
  - Real-time metadata tracking during generation
  - Continuous generation until AI naturally finishes

### Fixed
- **UI Layout**: Improved "Generation Paused" dialog spacing and button sizes
- **TypeScript Compilation**: Fixed all TS errors for clean builds
- **Assertion Handling**: Better assertion validation and error handling
- **AI Service Stability**: Improved error handling and abort signal propagation

### Known Issues
- Comprehensive testing still needed across all AI providers
- Windows and Linux builds not yet tested
- Some edge cases in workflow tests may not be fully handled
- Pre/post scripts not yet implemented

### Notes
⚠️ **This is a BETA release** - not recommended for production use. Please report any issues on GitHub.

## [1.1.0] - 2024-10-XX

### Added
- Endpoint editing functionality
- Enhanced assertion system
- Improved test generation workflow

### Fixed
- cURL import issues

## [1.0.0] - 2024-10-XX

### Added
- Initial release
- Import OpenAPI 3.x, Swagger 2.0, Postman Collection v2.x, cURL
- AI-powered test generation (OpenAI, Anthropic, Google Gemini, Ollama)
- Batch test generation from multiple endpoints
- Test execution with 7 assertion types
- Environment management
- Local data persistence with IndexedDB
- Cross-platform desktop app (macOS, Windows, Linux)
