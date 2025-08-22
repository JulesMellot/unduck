# Étape de construction
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration
COPY package.json pnpm-lock.yaml ./

# Installer pnpm
RUN npm install -g pnpm

# Installer les dépendances
RUN pnpm install

# Copier le reste du code source
COPY . .

# Construire l'application
RUN pnpm run build

# Étape de production
FROM node:20-alpine

WORKDIR /app

# Installer pnpm et un serveur HTTP simple
RUN npm install -g pnpm serve

# Copier les fichiers de configuration
COPY package.json pnpm-lock.yaml ./

# Installer seulement les dépendances de production
RUN pnpm install --prod

# Copier les fichiers construits depuis l'étape de construction
COPY --from=builder /app/dist ./dist

# Exposer le port 3000
EXPOSE 3000

# Démarrer l'application
CMD ["serve", "-s", "dist", "-l", "3000"]