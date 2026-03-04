"""
Phase 2: Stripe Plan Mapping - Test Suite
==========================================
Tests for new subscription tier system, Stripe price mapping,
and migration helper endpoints.
"""

import pytest
from datetime import datetime, timezone
import sys
sys.path.insert(0, '/app/backend')

from subscription_config import (
    SUBSCRIPTION_TIERS,
    LEGACY_TIER_MAPPING,
    STRIPE_NEW_PRICE_IDS,
    get_tier_config,
    get_tier_limits,
    get_stripe_price_id,
    is_tier_stripe_ready,
    get_available_tiers_for_signup,
    get_tier_comparison,
)


class TestSubscriptionTiers:
    """Test subscription tier configuration"""
    
    def test_all_new_tiers_exist(self):
        """Verify all three new tiers are configured"""
        assert "individual_coach" in SUBSCRIPTION_TIERS
        assert "coach_developer" in SUBSCRIPTION_TIERS
        assert "club" in SUBSCRIPTION_TIERS
    
    def test_individual_coach_tier_config(self):
        """Test Individual Coach tier has correct limits"""
        tier = SUBSCRIPTION_TIERS["individual_coach"]
        
        # Verify pricing
        assert tier["pricing"]["monthly"] == 600  # £6
        assert tier["pricing"]["annual"] == 6000  # £60
        assert tier["pricing"]["currency"] == "gbp"
        
        # Verify limits
        assert tier["limits"]["max_coach_developers"] == 1
        assert tier["limits"]["max_coaches"] == 0  # Self-only
        assert tier["limits"]["max_observations_per_coach"] is None  # Unlimited
        
        # Verify features
        assert tier["features"]["self_observation"] is True
    
    def test_coach_developer_tier_config(self):
        """Test Coach Developer tier has correct limits"""
        tier = SUBSCRIPTION_TIERS["coach_developer"]
        
        # Verify pricing
        assert tier["pricing"]["monthly"] == 1000  # £10
        assert tier["pricing"]["annual"] == 10000  # £100
        
        # Verify limits
        assert tier["limits"]["max_coach_developers"] == 1
        assert tier["limits"]["max_coaches"] is None  # Unlimited
        assert tier["limits"]["max_observations_per_coach"] == 10  # 10 per coach
        
        # Verify features
        assert tier["features"]["self_observation"] is False
    
    def test_club_tier_config(self):
        """Test Club tier has correct limits"""
        tier = SUBSCRIPTION_TIERS["club"]
        
        # Verify pricing
        assert tier["pricing"]["monthly"] == 6000  # £60
        assert tier["pricing"]["annual"] == 60000  # £600
        
        # Verify limits
        assert tier["limits"]["max_coach_developers"] == 5
        assert tier["limits"]["max_coaches"] == 30
        assert tier["limits"]["max_observations_per_coach"] is None  # Unlimited


class TestLegacyMapping:
    """Test legacy tier mapping configuration"""
    
    def test_legacy_individual_maps_to_coach_developer(self):
        """Old 'individual' maps to 'coach_developer'"""
        assert LEGACY_TIER_MAPPING["individual"] == "coach_developer"
    
    def test_legacy_developer_maps_to_coach_developer(self):
        """Old 'developer' maps to 'coach_developer'"""
        assert LEGACY_TIER_MAPPING["developer"] == "coach_developer"
    
    def test_legacy_club_maps_to_club(self):
        """'club' tier remains 'club'"""
        assert LEGACY_TIER_MAPPING["club"] == "club"
    
    def test_legacy_free_maps_to_coach_developer(self):
        """'free' tier maps to 'coach_developer'"""
        assert LEGACY_TIER_MAPPING["free"] == "coach_developer"


class TestStripePriceConfiguration:
    """Test Stripe price ID configuration"""
    
    def test_club_stripe_prices_configured(self):
        """Club tier should have existing Stripe price IDs"""
        club_config = STRIPE_NEW_PRICE_IDS.get("club", {})
        
        # Monthly
        assert club_config["monthly"]["price_id"] is not None
        assert club_config["monthly"]["amount"] == 6000
        
        # Annual
        assert club_config["annual"]["price_id"] is not None
        assert club_config["annual"]["amount"] == 60000
    
    def test_new_tiers_prices_pending(self):
        """New tiers should have prices pending configuration"""
        # Individual Coach
        individual = STRIPE_NEW_PRICE_IDS.get("individual_coach", {})
        assert individual["monthly"]["price_id"] is None
        assert individual["annual"]["price_id"] is None
        assert individual["monthly"]["amount"] == 600
        assert individual["annual"]["amount"] == 6000
        
        # Coach Developer
        coach_dev = STRIPE_NEW_PRICE_IDS.get("coach_developer", {})
        assert coach_dev["monthly"]["price_id"] is None
        assert coach_dev["annual"]["price_id"] is None
        assert coach_dev["monthly"]["amount"] == 1000
        assert coach_dev["annual"]["amount"] == 10000
    
    def test_is_tier_stripe_ready(self):
        """Test stripe readiness check"""
        # Club should be ready (has price IDs)
        assert is_tier_stripe_ready("club") is True
        
        # New tiers should not be ready (pending price IDs)
        assert is_tier_stripe_ready("individual_coach") is False
        assert is_tier_stripe_ready("coach_developer") is False
    
    def test_get_stripe_price_id(self):
        """Test price ID retrieval"""
        # Club has price IDs
        assert get_stripe_price_id("club", "monthly") is not None
        assert get_stripe_price_id("club", "annual") is not None
        
        # New tiers don't have price IDs yet
        assert get_stripe_price_id("individual_coach", "monthly") is None
        assert get_stripe_price_id("coach_developer", "annual") is None


class TestTierHelperFunctions:
    """Test tier configuration helper functions"""
    
    def test_get_tier_config_valid_tier(self):
        """Get config for valid tier"""
        config = get_tier_config("coach_developer")
        assert config["name"] == "Coach Developer"
        assert "limits" in config
        assert "pricing" in config
    
    def test_get_tier_config_legacy_tier_mapping(self):
        """Legacy tier should map to new tier config"""
        # "individual" (legacy) should get "coach_developer" config
        config = get_tier_config("individual")
        assert config["name"] == "Coach Developer"
    
    def test_get_tier_config_invalid_tier_fallback(self):
        """Invalid tier should fall back to coach_developer"""
        config = get_tier_config("nonexistent_tier")
        assert config["name"] == "Coach Developer"
    
    def test_get_tier_limits(self):
        """Test getting just the limits"""
        limits = get_tier_limits("club")
        assert limits["max_coach_developers"] == 5
        assert limits["max_coaches"] == 30


class TestSignupAndPricingHelpers:
    """Test helpers for signup and pricing pages"""
    
    def test_get_available_tiers_for_signup(self):
        """Test tiers available for new signups"""
        available = get_available_tiers_for_signup()
        
        # All three new tiers should be present
        assert "individual_coach" in available
        assert "coach_developer" in available
        assert "club" in available
        
        # Legacy tiers should NOT be present
        assert "individual" not in available
        assert "developer" not in available
        
        # Each tier should have stripe_ready flag
        for tier_key, tier_data in available.items():
            assert "stripe_ready" in tier_data
            assert "available_for_signup" in tier_data
    
    def test_get_tier_comparison_order(self):
        """Test pricing comparison returns tiers in correct order"""
        comparison = get_tier_comparison()
        
        assert len(comparison) == 3
        
        # Order should be: individual_coach, coach_developer, club
        assert comparison[0]["tier_key"] == "individual_coach"
        assert comparison[1]["tier_key"] == "coach_developer"
        assert comparison[2]["tier_key"] == "club"
    
    def test_get_tier_comparison_pricing_format(self):
        """Test pricing is converted from pence to pounds"""
        comparison = get_tier_comparison()
        
        # Individual Coach: £6/month
        individual = comparison[0]
        assert individual["pricing"]["monthly"] == 6.0  # Pounds, not pence
        assert individual["pricing"]["annual"] == 60.0
        
        # Coach Developer: £10/month
        coach_dev = comparison[1]
        assert coach_dev["pricing"]["monthly"] == 10.0
        assert coach_dev["pricing"]["annual"] == 100.0
        
        # Club: £60/month
        club = comparison[2]
        assert club["pricing"]["monthly"] == 60.0
        assert club["pricing"]["annual"] == 600.0
    
    def test_get_tier_comparison_highlight(self):
        """Coach Developer should be highlighted as most popular"""
        comparison = get_tier_comparison()
        
        assert comparison[0]["highlight"] is False  # individual_coach
        assert comparison[1]["highlight"] is True   # coach_developer (most popular)
        assert comparison[2]["highlight"] is False  # club


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
