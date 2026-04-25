"use client";

import { SiteInfo, NetlifyUser, Artwork } from "@/types/types";
import UploadSiteInfoForm from "./UploadSiteInfoForm";
import { useState } from "react";
import UploadImageForm from "./UploadImageForm";
import Modal from "./Modal";
import CustomButton from "./CustomButton";
import SiteHeader from "./SiteHeader";

export default function AdminHeader({
  siteInfo,
  user,
  onOpenSettings,
  onArtworkUploaded,
  onSaveOrder,
  isSavingOrder,
}: {
  siteInfo: SiteInfo;
  user: NetlifyUser;
  onOpenSettings: () => void;
  onArtworkUploaded: (artwork: Artwork) => void;
  onSaveOrder?: () => void;
  isSavingOrder?: boolean;
}) {
  const [displayTitle, setDisplayTitle] = useState(siteInfo.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isInPreviewMode, setIsInPreviewMode] = useState(false);

  function getToken(): string | null {
    return window.netlifyIdentity.currentUser()?.token?.access_token ?? null;
  }

  function handleLogout() {
    window.netlifyIdentity.logout();
  }

  const animateClassName = "transition-all ease-in-out duration-600";

  const HeaderTitleBox = () => (
    <div id="header-title-box">
      {isInPreviewMode ? (
        <h1 id="title" className="leading-tight max-w-72">
          {displayTitle}
        </h1>
      ) : !isEditingTitle ? (
        <h1
          id="title"
          onClick={() => {
            setIsEditingTitle(true);
            setTitleError(null);
          }}
          className="cursor-pointer hover:underline leading-tight max-w-72"
        >
          {displayTitle || "Add a title"}
        </h1>
      ) : (
        <UploadSiteInfoForm
          getToken={getToken}
          setIsEditingTitle={setIsEditingTitle}
          onOptimisticUpdate={setDisplayTitle}
          onError={(msg) => {
            setDisplayTitle(siteInfo.title);
            setTitleError(msg);
          }}
        />
      )}
      {titleError && <p className="text-xs text-red-400 mt-1">{titleError}</p>}
    </div>
  );

  const HeaderNavLinks = () => (
    <div
      id="header-nav-links"
      className="flex flex-col md:flex-row justify-end items-center gap-1 lg:gap-4 text-xs xl:text-sm text-neutral-400"
    >
      {isInPreviewMode ? (
        <button
          onClick={() => setIsInPreviewMode(false)}
          className="hover:text-neutral-300 underline underline-offset-2 text-xs"
        >
          Edit Site
        </button>
      ) : (
        <>
          <button
            onClick={onOpenSettings}
            className="hover:text-neutral-300 hover:underline underline-offset-2 text-lg xl:text-xl"
          >
            {user.user_metadata?.full_name || "create username"}
          </button>

          <button
            onClick={handleLogout}
            className="hover:text-neutral-300 underline underline-offset-2"
          >
            Sign out
          </button>

          <button
            onClick={() => {
              setIsInPreviewMode(true);
              setIsEditingTitle(false);
            }}
            className="underline underline-offset-2 hover:text-neutral-300"
          >
            Preview Site
          </button>
        </>
      )}
    </div>
  );

  return (
    <div id="header-wrapper" className="relative overflow-hidden">
      <div
        id="header-admin-animated-background"
        className={`absolute inset-0 bg-neutral-700 ${animateClassName} ${isInPreviewMode ? "-translate-y-full" : "translate-y-0"}`}
      />
      <SiteHeader className={`overflow-hidden relative`}>
        <div
          id="header-content"
          className={`
            flex 
            flex-col 
            gap-4
            ${
              isInPreviewMode
                ? "md:flex-row justify-between"
                : "md:grid grid-cols-3"
            } 
            items-center 
            px-4
            `}
        >
          <HeaderTitleBox />

          {!isInPreviewMode && (
            <div
              id="header-upload-button-container"
              className="flex flex-col md:flex-row justify-center gap-3 flex-wrap"
            >
              <CustomButton onClick={() => setIsUploadModalOpen(true)}>
                Upload Artwork
              </CustomButton>
              {onSaveOrder && (
                <CustomButton onClick={onSaveOrder} disabled={isSavingOrder}>
                  {isSavingOrder ? "Saving…" : "Save Order"}
                </CustomButton>
              )}
            </div>
          )}

          <HeaderNavLinks />
        </div>

        {isUploadModalOpen && (
          <Modal onClose={() => setIsUploadModalOpen(false)}>
            <div id="upload-form-header" className="p-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-sm uppercase tracking-widest text-neutral-400">
                  Upload artwork
                </h2>
              </div>
              <UploadImageForm
                getToken={getToken}
                onSuccess={onArtworkUploaded}
              />
            </div>
          </Modal>
        )}
      </SiteHeader>
    </div>
  );
}
