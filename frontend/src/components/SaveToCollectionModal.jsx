import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { getCollections, createCollection, toggleResourceInCollection } from "../api/collection.api";
import "./SaveToCollectionModal.css";

const SaveToCollectionModal = ({ resourceId, onClose, onSuccess }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const data = await getCollections();
      setCollections(data);
    } catch {
      toast.error("Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      setIsCreating(true);
      const newCol = await createCollection({
        name: newCollectionName.trim(),
        initialResourceId: resourceId,
      });
      setCollections([newCol, ...collections]);
      setNewCollectionName("");
      toast.success("Collection created and resource saved!");
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create collection");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (collection) => {
    try {
      setProcessingId(collection._id);
      const res = await toggleResourceInCollection(collection._id, resourceId);
      
      // Update local state to reflect addition/removal
      setCollections((prev) =>
        prev.map((c) => {
          if (c._id === collection._id) {
            return {
              ...c,
              resources: res.added
                ? [...c.resources, { _id: resourceId }]
                : c.resources.filter((r) => r._id !== resourceId && r !== resourceId),
            };
          }
          return c;
        })
      );
      toast.success(res.message);
      if (onSuccess) onSuccess();
    } catch {
      toast.error("Failed to update collection");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="gs-modal-backdrop" onClick={onClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <h2>Save to Collection</h2>
          <button className="gs-icon-btn" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="scm-body">
          {loading ? (
            <div className="gs-spinner-sm" style={{ margin: "20px auto" }} />
          ) : (
            <div className="scm-list">
              {collections.map((c) => {
                const isSaved = c.resources.some((r) => (r._id || r) === resourceId);
                return (
                  <div key={c._id} className="scm-item" onClick={() => handleToggle(c)}>
                    <div className="scm-item-left">
                      <div className="scm-cover" style={{ backgroundColor: c.coverColor }}>
                        <span className="material-icons">folder</span>
                      </div>
                      <span className="scm-name">{c.name}</span>
                    </div>
                    <button
                      className={`scm-btn ${isSaved ? "saved" : ""}`}
                      disabled={processingId === c._id}
                    >
                      {processingId === c._id ? (
                        <div className="gs-spinner-sm" />
                      ) : isSaved ? (
                        "Saved"
                      ) : (
                        "Save"
                      )}
                    </button>
                  </div>
                );
              })}
              {collections.length === 0 && (
                <p className="scm-empty">No collections yet.</p>
              )}
            </div>
          )}
        </div>

        <div className="scm-footer">
          <form onSubmit={handleCreate} className="scm-create-form">
            <input
              type="text"
              placeholder="Create new collection..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              disabled={isCreating}
            />
            <button
              type="submit"
              className="scm-create-btn"
              disabled={!newCollectionName.trim() || isCreating}
            >
              {isCreating ? <div className="gs-spinner-sm" /> : "Create"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SaveToCollectionModal;
