import { Suspense } from "react";
import { InvitationAccept } from "./invitation-accept";

export default function InvitationPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        }
      >
        <InvitationAccept />
      </Suspense>
    </div>
  );
}
