import { redirect } from 'next/navigation';

/** Legacy path — catalog lives at `/`. */
export default function ToolsRedirect() {
  redirect('/');
}
