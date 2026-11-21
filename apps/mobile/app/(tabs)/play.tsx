import { Redirect } from 'expo-router';

/** The centre tab button opens Create Game directly; this screen is never shown on its own. */
export default function Play() {
  return <Redirect href="/create" />;
}
