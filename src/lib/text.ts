export const clampText = (value: string, limit: number) =>
  value.length > limit ? value.slice(0, limit) : value
