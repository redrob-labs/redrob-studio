import { redirect } from 'next/navigation';

/** Legacy path — Create is `/image/create`. */
export default function ImageGenerateRedirect() {
  redirect('/image/create');
}
