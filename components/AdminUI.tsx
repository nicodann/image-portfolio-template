"use client";

import { useEffect, useState } from "react";
import { Artwork, SiteInfo, NetlifyUser } from "@/types/types";
import MasonryGrid from "./MasonryGrid";
import AdminHeader from "./AdminHeader";
import Modal from "./Modal";
import EditArtworkForm from "./EditArtworkForm";
import UserSettingsForm from "./UserSettingsForm";
import SetupModal from "./SetupModal";

export default function AdminUI({
  artwork,
  siteInfo,
}: {
  artwork: Artwork[];
  siteInfo: SiteInfo;
}) {
  const [artworkList, setArtworkList] = useState<Artwork[]>(artwork);
  const [user, setUser] = useState<NetlifyUser | null>(null);
  const [ready, setReady] = useState(false);
  const [autoLoggedOut, setAutoLoggedOut] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Artwork | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<Artwork | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  function getToken(): string | null {
    return window.netlifyIdentity.currentUser()?.token?.access_token ?? null;
  }

  function handleApiResponse(res: Response) {
    if (res.status === 401) {
      console.error("[handleApiResponse] 401 — logging out");
      setAutoLoggedOut(true);
      window.netlifyIdentity.logout();
      return false;
    }
    return true;
  }

  function handleReorder(reordered: Artwork[]) {
    setArtworkList(reordered);
    setOrderDirty(true);
  }

  async function saveOrder() {
    const token = getToken();

    if (!token) return;

    setIsSavingOrder(true);

    const res = await fetch("/.netlify/functions/reorder-artwork", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: artworkList.map((a) => a.id) }),
    });

    setIsSavingOrder(false);

    if (!handleApiResponse(res)) return;

    if (res.ok) {
      setOrderDirty(false);
    } else {
      alert("Failed to save order");
    }
  }

  function handleEditSuccess(updated: Artwork) {
    setArtworkList((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
    setPendingEdit(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    const token =
      window.netlifyIdentity.currentUser()?.token?.access_token ?? null;
    if (!token) return;

    setIsDeleting(true);

    const res = await fetch("/.netlify/functions/delete-artwork", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: pendingDelete.id,
        imageUrl: pendingDelete.imageUrl,
      }),
    });

    setIsDeleting(false);

    if (!handleApiResponse(res)) return;

    if (res.ok) {
      setArtworkList((prev) => prev.filter((a) => a.id !== pendingDelete.id));
      setPendingDelete(null);
    } else {
      const { error } = await res.json();
      alert(`Delete failed: ${error}`);
    }
  }

  useEffect(() => {
    let tokenInterval: ReturnType<typeof setInterval>;
    let isRefreshing = false;

    async function checkToken() {
      const u = window.netlifyIdentity.currentUser() as NetlifyUser | null;
      if (!u?.token?.expires_at) return;

      const expiresAt = u.token.expires_at;
      const fiveMinutes = 5 * 60 * 1000;
      // const fiveMinutes = 60 * 60 * 1000;
      // const msLeft = expiresAt - Date.now();
      // console.log(
      //   "[checkToken] expires_at:",
      //   u.token.expires_at,
      //   "| ms until expiry:",
      //   msLeft,
      //   "| will refresh:",
      //   msLeft <= fiveMinutes,
      // );

      const msLeft = expiresAt - Date.now();
      // console.log("[checkToken] msLeft:", msLeft, "| will refresh:", msLeft <= fiveMinutes);

      if (Date.now() >= expiresAt - fiveMinutes) {
        if (isRefreshing) return;
        isRefreshing = true;
        // console.log("[checkToken] attempting refresh");
        try {
          await window.netlifyIdentity.refresh(true);
          const refreshed = window.netlifyIdentity.currentUser() as NetlifyUser;
          const newExpiry = refreshed?.token?.expires_at ?? 0;
          // console.log("[checkToken] after refresh, newExpiry:", newExpiry, "| now:", Date.now(), "| expired:", newExpiry <= Date.now());
          if (newExpiry <= Date.now()) {
            throw new Error("Token still expired after refresh");
          }
          setUser(refreshed);
        } catch (err) {
          if (Date.now() >= expiresAt) {
            console.error(
              "[checkToken] refresh failed and token expired, logging out:",
              err,
            );
            setAutoLoggedOut(true);
            window.netlifyIdentity.logout();
          } else {
            console.warn(
              "[checkToken] refresh failed but token still valid, will retry:",
              err,
            );
          }
        } finally {
          isRefreshing = false;
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // console.log("tab became visible, checking token");
        checkToken();
      }
    };

    async function init() {
      const ni = window.netlifyIdentity;
      ni.init();

      const currentUser = ni.currentUser() as NetlifyUser | null;
      setUser(currentUser);
      setReady(true);

      ni.on("login", (user) => {
        const u = user as NetlifyUser;
        // console.log("[netlifyIdentity] login event, expires_at:", u?.token?.expires_at);
        setUser(u);
        setAutoLoggedOut(false);
        ni.close();
        if (!u.user_metadata?.full_name || !siteInfo.title) {
          setSetupOpen(true);
        }
      });

      ni.on("logout", () => {
        // console.log("[netlifyIdentity] logout event");
        setUser(null);
      });

      await checkToken();

      tokenInterval = setInterval(checkToken, 1_000);

      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    if (window.netlifyIdentity) {
      init();
    } else {
      const pollingInterval = setInterval(() => {
        if (window.netlifyIdentity) {
          clearInterval(pollingInterval);
          init();
        }
      }, 50);
      return () => {
        clearInterval(pollingInterval);
        clearInterval(tokenInterval);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }

    return () => {
      clearInterval(tokenInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  //// RENDER //////////////////////////

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-600 text-sm">Loading…</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        {autoLoggedOut && (
          <p className="text-yellow-400 text-sm">
            Your session expired. Please sign in again.
          </p>
        )}
        <p className="text-neutral-400 text-sm">Sign in to manage artwork.</p>
        <button
          onClick={() => window.netlifyIdentity.open("login")}
          className="px-5 py-2 bg-neutral-100 text-neutral-950 text-sm font-medium rounded-sm hover:bg-white transition-colors"
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main id="admin-main">
      <AdminHeader
        siteInfo={siteInfo}
        user={user}
        onOpenSettings={() => setSettingsOpen(true)}
        onArtworkUploaded={(a) => setArtworkList((prev) => [a, ...prev])}
        onSaveOrder={orderDirty ? saveOrder : undefined}
        isSavingOrder={isSavingOrder}
      />
      <MasonryGrid
        artwork={artworkList}
        onDelete={setPendingDelete}
        onEdit={setPendingEdit}
        onReorder={handleReorder}
      />

      {setupOpen && (
        <SetupModal
          user={user}
          getToken={getToken}
          onClose={() => setSetupOpen(false)}
          onComplete={(updatedUser) => {
            console.log("On complete called with :", updatedUser);
            setUser(updatedUser);
            setSetupOpen(false);
          }}
        />
      )}

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)}>
          <div className="bg-neutral-900 rounded-sm p-8 max-w-lg w-full ">
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-8">
              Settings
            </h2>
            <UserSettingsForm
              user={user}
              getToken={getToken}
              onSuccess={(updatedUser) => {
                setUser(updatedUser);
                setSettingsOpen(false);
              }}
            />
          </div>
        </Modal>
      )}

      {pendingEdit && (
        <Modal onClose={() => setPendingEdit(null)}>
          <div className="bg-neutral-900 rounded-sm p-8 max-w-2xl w-full">
            <h2 className="text-sm uppercase tracking-widest text-neutral-400 mb-8">
              Edit artwork
            </h2>
            <EditArtworkForm
              artwork={pendingEdit}
              getToken={getToken}
              onSuccess={handleEditSuccess}
            />
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal onClose={() => setPendingDelete(null)}>
          <div className="bg-neutral-900 rounded-sm p-8 max-w-sm w-full text-center">
            <h2 className="text-neutral-100 text-lg font-medium mb-2">
              Delete artwork?
            </h2>
            <p className="text-neutral-400 text-sm mb-6">
              &ldquo;{pendingDelete.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-sm transition-colors"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
