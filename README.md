# Scalable E-Commerce Microservices Platform

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/ecommerce-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/ecommerce-platform/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade, cloud-native e-commerce platform built with a microservices architecture. Designed to demonstrate industry-level software engineering practices including domain-driven design, JWT authentication with token rotation, PostgreSQL full-text search, Docker containerization, and automated CI/CD.

---

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │    │  Auth Svc    │    │  Product Svc │
│  React + TS  │───▶│  Port 3001   │    │  Port 3002   │
│  Tailwind    │    │  PostgreSQL  │    │  PostgreSQL  │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       │            ┌──────────────┐    ┌──────────────┐
       └───────────▶│  Order Svc   │    │  Payment Svc │
                    │  Port 3003   │───▶│  Port 3004   │
                    │  PostgreSQL  │    │  Stripe API  │
                    └──────────────┘    └──────────────┘
                                               │
                                        ┌──────▼───────┐
                                        │ Notification │
                                        │  Port 3005   │
                                        │  Nodemailer  │
                                        └──────────────┘
```

## Tech Stack

| Category         | Technology                            |
| ---------------- | ------------------------------------- |
| Backend          | Node.js, Express.js                   |
| Database         | PostgreSQL (per service)              |
| Caching          | Redis                                 |
| Auth             | JWT (access + refresh token rotation) |
| Payments         | Stripe                                |
| Frontend         | React, TypeScript, Tailwind CSS       |
| Containerization | Docker, Docker Compose                |
| CI/CD            | GitHub Actions                        |
| Deployment       | Railway / Render + Vercel             |

## Key Features

- **JWT Token Rotation** — short-lived access tokens + long-lived refresh tokens stored as HttpOnly cookies (XSS-safe)
- **Brute-Force Protection** — account lockout after failed login attempts
- **Full-Text Product Search** — PostgreSQL GIN index with `tsvector`
- **Atomic Inventory Updates** — race-condition-safe stock decrements
- **Soft Delete** — products/orders never hard-deleted (preserves history)
- **Graceful Shutdown** — zero request drops on deployment
- **Structured Logging** — JSON logs in production (compatible with Datadog/CloudWatch)
- **Rate Limiting** — per-IP request throttling on all auth endpoints
- **Input Validation** — whitelist validation on every endpoint

## Getting Started

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### Local Development

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ecommerce-platform.git
cd ecommerce-platform

# Copy environment files
cp backend/services/auth-service/.env.example backend/services/auth-service/.env
cp backend/services/product-service/.env.example backend/services/product-service/.env
cp backend/services/order-service/.env.example backend/services/order-service/.env

# Start all infrastructure (databases, redis)
docker-compose -f docker/docker-compose.yml up postgres_auth postgres_products postgres_orders redis

# Install and start auth service
cd backend/services/auth-service
npm install
npm run dev

# In another terminal, start product service
cd backend/services/product-service
npm install
npm run dev
```

### Run with Docker (Full Stack)

```bash
docker-compose -f docker/docker-compose.yml up --build
```

### Run Tests

```bash
cd backend/services/auth-service
npm test
```

## API Documentation

### Auth Service (Port 3001)

| Method | Endpoint             | Auth   | Description                 |
| ------ | -------------------- | ------ | --------------------------- |
| POST   | `/api/auth/register` | No     | Register new user           |
| POST   | `/api/auth/login`    | No     | Login, returns access token |
| POST   | `/api/auth/refresh`  | Cookie | Refresh access token        |
| POST   | `/api/auth/logout`   | Bearer | Revoke refresh token        |
| GET    | `/api/auth/me`       | Bearer | Get current user profile    |

### Product Service (Port 3002)

| Method | Endpoint              | Auth  | Description                           |
| ------ | --------------------- | ----- | ------------------------------------- |
| GET    | `/api/products`       | No    | List products (paginated, filterable) |
| GET    | `/api/products/:slug` | No    | Get product by slug                   |
| POST   | `/api/products`       | Admin | Create product                        |
| PATCH  | `/api/products/:id`   | Admin | Update product                        |
| DELETE | `/api/products/:id`   | Admin | Soft-delete product                   |

## Project Structure

```
ecommerce-platform/
├── backend/
│   └── services/
│       ├── auth-service/        # JWT auth, user management
│       ├── product-service/     # Catalog, search, inventory
│       ├── order-service/       # Order lifecycle management
│       ├── payment-service/     # Stripe integration
│       └── notification-service/# Email notifications
├── frontend/                    # React + TypeScript SPA
├── docker/                      # Docker Compose config
└── .github/workflows/           # CI/CD pipelines
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step cloud deployment instructions (Railway + Vercel).

## License

MIT
