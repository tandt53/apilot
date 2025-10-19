/**
 * Get Tailwind CSS classes for HTTP method badge colors
 */
export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700 border-green-300',
    POST: 'bg-blue-100 text-blue-700 border-blue-300',
    PUT: 'bg-orange-100 text-orange-700 border-orange-300',
    DELETE: 'bg-red-100 text-red-700 border-red-300',
    PATCH: 'bg-purple-100 text-purple-700 border-purple-300',
  }
  return colors[method] || 'bg-gray-100 text-gray-700 border-gray-300'
}
