import { onReceivedNotification } from '@/lib/events';
import { sendMail } from '@/lib/send-mail';
import { addNotification } from '@/services/notifications.service';

type AddProductNotificationOptions = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  product: {
    id: string;
    title: string;
  };
};
export const addProductNotification = async ({ user, product }: AddProductNotificationOptions) => {
  const title = `Product - ${product.title} added successfully`;
  const message = `Hey ${user.name}, ${product.title} is added to the store. You can now register the product for the auction`;
  await Promise.all([
    sendMail({ mail: user.email, subject: title, text: message }),
    addNotification({
      title,
      description: message,
      entity: 'products',
      params: product.id,
      userId: user.id
    }).then(([notification]) => {
      if (!notification) return;
      onReceivedNotification(notification.userId, { notification });
    })
  ]);
};
