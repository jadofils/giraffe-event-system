// src/index.ts
import app from './app';
import { AppConfig } from './config/AppConfig';
import { initializeDatabase } from './config/Database';

// Bootstrap function to start the application
async function bootstrap() {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Start the server
    app.listen(AppConfig.PORT, () => {
      console.log(`Server running on port ${AppConfig.PORT}`);
      console.log(`API available at http://localhost:${AppConfig.PORT}${AppConfig.API_PREFIX}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
bootstrap();