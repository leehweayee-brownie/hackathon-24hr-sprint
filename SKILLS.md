# Skills Demonstrated

This project demonstrates practical software engineering skills used in production-grade applications.

---

# AI Engineering

- Vision model classification and extraction behind one interface
- Structured output validated with Zod, retried when invalid
- Every value carries a confidence and a bounding box back to its source
- Human-in-the-loop confirmation below a threshold
- Deterministic rules engine makes decisions; the model never sets the score
- Recorded model responses for offline tests and demos
- Token and cost accounting per document

---

# Backend

## NestJS

- Modular Architecture
- Dependency Injection
- Guards
- Pipes
- Interceptors
- Exception Filters
- Middleware
- Custom Decorators
- Validation Pipe

---

## API Design

- RESTful API
- DTO Validation
- Pagination
- Versioning
- Consistent Error Responses

---

## Authentication & Authorization

- JWT Authentication
- Refresh Token Rotation
- Password Hashing (Argon2)
- Role-Based Access Control (RBAC)
- Protected Routes

---

## Database

- PostgreSQL
- Prisma ORM
- Database Normalization
- Transactions
- Optimized Queries
- Indexing

---

## Security

- SQL Injection Prevention
- XSS Protection
- Rate Limiting
- Helmet
- CORS
- Secure Password Storage
- Environment Variable Management
- Input Validation
- Authentication Best Practices

---

# Frontend

## Next.js

- App Router
- Server Components
- Client Components
- API Integration
- Route Protection

---

## React

- Functional Components
- Hooks
- Custom Hooks
- State Management
- Performance Optimization

---

## State Management

- Zustand

---

## Forms

- React Hook Form
- Zod Validation

---

## Styling

- Tailwind CSS
- Responsive Design
- Dark Mode Ready
- Framer Motion (documents sorting into place, trust score ring)

---

# Software Architecture

- Clean Architecture
- Layered Architecture
- Repository Pattern
- Service Pattern
- SOLID Principles
- DRY
- KISS
- Separation of Concerns

---

# Testing

Backend

- Jest (API), Vitest (rules engine)
- Unit Testing (rules, normalization, CIDB limits, trust score)
- Integration Testing (upload to findings pipeline)
- End-to-End Testing

Frontend

- React Testing Library
- Playwright

---

# DevOps

- Docker
- Docker Compose
- Environment Configuration
- GitHub Actions CI
- Production Build
- Health Checks

---

# Performance

- Query Optimization
- Caching
- Lazy Loading
- Memoization
- Efficient Database Indexes

---

# Observability

- Request Logging
- Error Logging
- Health Endpoint
- Structured Logs

---

# Git

- Feature Branch Workflow
- Pull Requests
- Conventional Commits
- Semantic Versioning

---

# Soft Skills Demonstrated

- Problem Solving
- System Design
- Clean Code
- Secure Development
- Documentation
- Maintainability
- Scalability
- Code Readability
- Testing Mindset
- Performance Optimization

---

# Design Patterns Used

- Dependency Injection
- Repository Pattern
- Strategy Pattern (`ExtractionProvider`: Anthropic vision model or recorded mock)
- Factory Pattern (storage adapter: S3-compatible or local disk)
- Adapter Pattern (Redis pub/sub bridge between the worker and the Socket.IO gateway)
- Pipeline / State Machine (document processing states)
- Singleton Pattern (validated configuration)
- Pure Functions (rules engine: same input, same findings and score)

---

# Production Best Practices

- Feature-Based Folder Structure
- Environment Isolation
- Secret Management
- Reusable Components
- Validation at Every Layer
- Exception Handling
- API Documentation with Swagger
- Database Migrations
- Code Reviews
- CI/CD Ready

---

# Project Outcome

This project showcases the ability to build a secure, scalable, and maintainable full-stack application following modern software engineering practices. It demonstrates expertise in backend development with NestJS, frontend development with Next.js, relational database design using PostgreSQL, secure authentication, explainable AI document extraction with human confirmation, a deterministic rules engine, clean architecture, and production-ready deployment workflows.