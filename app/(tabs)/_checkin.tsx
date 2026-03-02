import { Redirect } from "expo-router";

// This screen is never shown — the tab button navigates directly to the modal.
export default function CheckInRedirect() {
  return <Redirect href="/modal" />;
}
