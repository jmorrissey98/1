// Migration Banner Component
// Shows migration information for legacy subscription users

import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { fetchMigrationStatus, migrateEarly, clearSubscriptionCaches } from '../lib/subscriptionApi';

export const MigrationBanner = ({ onMigrationComplete }) => {
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadMigrationStatus();
  }, []);

  const loadMigrationStatus = async () => {
    try {
      const result = await fetchMigrationStatus();
      if (result.ok && result.data) {
        setMigrationStatus(result.data);
      }
    } catch (err) {
      console.error('Failed to load migration status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateEarly = async () => {
    setMigrating(true);
    try {
      const result = await migrateEarly();
      if (result.ok && result.data?.success) {
        toast.success(result.data.message || 'Migration successful!');
        setShowDialog(false);
        clearSubscriptionCaches();
        await loadMigrationStatus();
        if (onMigrationComplete) {
          onMigrationComplete();
        }
      } else {
        toast.error(result.data?.message || 'Migration failed');
      }
    } catch (err) {
      toast.error('Failed to migrate subscription');
    } finally {
      setMigrating(false);
    }
  };

  // Don't show if loading, dismissed, not legacy, or no migration info
  if (loading || dismissed || !migrationStatus?.is_legacy || !migrationStatus?.migration_info) {
    return null;
  }

  const { migration_info } = migrationStatus;

  return (
    <>
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-amber-900">Subscription Migration</h4>
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                  {migration_info.old_tier_name}
                </Badge>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                {migration_info.message}
              </p>
              <div className="flex items-center gap-3">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="bg-white hover:bg-amber-50"
                  onClick={() => setShowDialog(true)}
                  data-testid="view-migration-details-btn"
                >
                  View Details
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
                <button
                  className="text-xs text-amber-600 hover:text-amber-800 underline"
                  onClick={() => setDismissed(true)}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              className="text-amber-400 hover:text-amber-600"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Migration Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Upgrade to {migration_info.new_tier_name}
            </DialogTitle>
            <DialogDescription>
              Your {migration_info.old_tier_name} plan is being migrated to our new subscription model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* What's changing */}
            <div className="p-3 bg-slate-50 rounded-lg">
              <h5 className="font-medium text-slate-700 mb-2">What's Changing</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">New Plan</span>
                  <span className="font-medium text-slate-900">{migration_info.new_tier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Monthly Price</span>
                  <span className="font-medium text-slate-900">£{migration_info.new_pricing?.monthly}/mo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Annual Price</span>
                  <span className="font-medium text-slate-900">£{migration_info.new_pricing?.annual}/yr</span>
                </div>
                {migration_info.new_limits?.observations_per_coach && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Observations/Coach</span>
                    <span className="font-medium text-slate-900">
                      {migration_info.new_limits.observations_per_coach === null ? 'Unlimited' : migration_info.new_limits.observations_per_coach}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-700 mb-2">When Does This Happen?</h5>
              <p className="text-sm text-blue-600">
                Your current plan features remain active until your next billing date. 
                The migration will complete automatically, or you can migrate early below.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              Keep Current Plan
            </Button>
            {migrationStatus.can_migrate_early && (
              <Button
                onClick={handleMigrateEarly}
                disabled={migrating}
                className="bg-blue-500 hover:bg-blue-600"
                data-testid="migrate-early-btn"
              >
                {migrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Migrate Now
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MigrationBanner;
