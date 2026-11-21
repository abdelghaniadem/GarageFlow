import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Boxes,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import pieceService from '../services/pieceService';
import PieceList from '../components/pieces/PieceList';
import PieceCreateModal from '../components/pieces/PieceCreateModal';
import PieceDetailModal from '../components/pieces/PieceDetailModal';
import PieceStockManager from '../components/pieces/PieceStockManager';
import { ROLES, ROLE_LABELS } from '../utils/constants';

export const PiecesDetachees = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [pieces, setPieces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [stockManagingPiece, setStockManagingPiece] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await pieceService.list();
      setPieces(data || []);
    } catch (err) {
      console.error('Erreur chargement catalogue de pièces :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des pièces détachées.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Actions CRUD
  const handlePieceCreated = (newPiece) => {
    setPieces((prev) => [newPiece, ...prev]);
    showToast(`Pièce "${newPiece.nom}" ajoutée avec succès au catalogue.`);
  };

  const handlePieceUpdated = (updatedPiece) => {
    setPieces((prev) =>
      prev.map((p) => (p.id_piece === updatedPiece.id_piece ? updatedPiece : p))
    );
    showToast(`Fiche pièce REF-#${updatedPiece.id_piece} mise à jour avec succès.`);
  };

  const handleStockUpdated = (updatedPiece) => {
    setPieces((prev) =>
      prev.map((p) => (p.id_piece === updatedPiece.id_piece ? updatedPiece : p))
    );
    showToast(
      `Stock de "${updatedPiece.nom}" mis à jour : ${updatedPiece.quantite_stock} unité(s) disponibles.`
    );
  };

  const handlePieceDeleted = (idPiece) => {
    setPieces((prev) => prev.filter((p) => p.id_piece !== idPiece));
    showToast(`Pièce REF-#${idPiece} supprimée du catalogue.`);
  };

  const handleDirectDelete = async (piece) => {
    if (
      !window.confirm(
        `Supprimer définitivement la pièce "${piece.nom}" (REF-#${piece.id_piece}) ?`
      )
    ) {
      return;
    }

    try {
      await pieceService.delete(piece.id_piece);
      handlePieceDeleted(piece.id_piece);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Impossible de supprimer cette pièce détachée.'}`);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-xs shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* En-tête du Module Pièces Détachées */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Catalogue & Stock de Pièces
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 mr-1 text-slate-400" />
                {user?.role ? ROLE_LABELS[user.role] : 'Atelier'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isResponsable
                ? "Inventaire des pièces détachées, gestion des prix, approvisionnements et alertes de stock."
                : "Consultation du catalogue d'atelier, des prix unitaires et des disponibilités de pièces."}
            </p>
          </div>
        </div>

        {/* Boutons d'action Header */}
        <div className="flex items-center space-x-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Rafraîchir le catalogue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          {isResponsable && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Pièce</span>
            </button>
          )}
        </div>
      </div>

      {/* Message d'erreur de chargement initial */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="px-3 py-1 bg-white border border-rose-300 rounded text-rose-800 font-semibold hover:bg-rose-100"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Contenu principal */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-slate-500">
            Chargement de l'inventaire et des stocks d'atelier...
          </p>
        </div>
      ) : (
        <PieceList
          pieces={pieces}
          onSelectPiece={(id) => setSelectedPieceId(id)}
          onEditPiece={(piece) => setSelectedPieceId(piece.id_piece)}
          onAdjustStock={(piece) => setStockManagingPiece(piece)}
          onDeletePiece={handleDirectDelete}
          userRole={user?.role}
        />
      )}

      {/* Modale de création Pièce Détachée (RESPONSABLE) */}
      {isCreateModalOpen && (
        <PieceCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handlePieceCreated}
        />
      )}

      {/* Modale de consultation / modification Pièce */}
      {selectedPieceId && (
        <PieceDetailModal
          isOpen={Boolean(selectedPieceId)}
          idPiece={selectedPieceId}
          onClose={() => setSelectedPieceId(null)}
          onUpdated={handlePieceUpdated}
          onDeleted={handlePieceDeleted}
          onOpenStockManager={(piece) => setStockManagingPiece(piece)}
          userRole={user?.role}
        />
      )}

      {/* Modale d'ajustement / approvisionnement rapide du stock (RESPONSABLE) */}
      {stockManagingPiece && (
        <PieceStockManager
          isOpen={Boolean(stockManagingPiece)}
          piece={stockManagingPiece}
          onClose={() => setStockManagingPiece(null)}
          onStockUpdated={handleStockUpdated}
        />
      )}
    </div>
  );
};

export default PiecesDetachees;
