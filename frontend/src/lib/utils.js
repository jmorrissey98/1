import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Format time in MM:SS or HH:MM:SS
export function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format date for display
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Format time for display
export function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calculate percentage
export function calcPercentage(part, total) {
  if (!total || total === 0) return 0;
  return Math.round((part / total) * 100);
}

// Generate a unique ID
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Group events by a key
export function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {});
}

// Count occurrences
export function countBy(array, key) {
  const groups = groupBy(array, key);
  return Object.keys(groups).reduce((counts, k) => {
    counts[k] = groups[k].length;
    return counts;
  }, {});
}
