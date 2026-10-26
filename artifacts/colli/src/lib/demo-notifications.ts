import { z } from 'zod';

export const demoNotificationsSchema = z.array(z.object({
  id: z.string(), title: z.string(), body: z.string(),
  kind: z.enum(['success', 'warning', 'alert', 'info']), read: z.boolean(),
  timestamp: z.string().datetime(),
}));
export type DemoNotification = z.infer<typeof demoNotificationsSchema>[number];
export function markDemoRead(items: DemoNotification[], id?: string): DemoNotification[] {
  return items.map(item => id === undefined || item.id === id ? { ...item, read: true } : item);
}
export const unreadDemoCount = (items: DemoNotification[]) => items.filter(item => !item.read).length;
