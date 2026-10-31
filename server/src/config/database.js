import mongoose from 'mongoose';
import { env } from './environment.js';

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = !!conn.connections[0].readyState;
    console.log(`MongoDB connected successfully`);
  } catch (error) {
    console.warn(`MongoDB connection warning: ${error.message}. Running in ephemeral/degraded persistence mode.`);
    isConnected = false;
  }

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('MongoDB connection lost.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('MongoDB reconnected.');
  });
}

export function isDatabaseReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function disconnectDatabase() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
