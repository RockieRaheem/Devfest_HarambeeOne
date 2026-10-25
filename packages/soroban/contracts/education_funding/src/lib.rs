#![no_std]

//! Experimental education-funding contract behind the deferred blockchain
//! roadmap boundary. It is not part of the active bursar ledger.
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub struct Allocation {
    pub beneficiary_ref: String,
    pub institution: Address,
    pub amount: i128,
    pub period_ref: String,
    pub active: bool,
    pub released: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Sponsor,
    Asset,
    Allocation(String),
    Paused,
}

#[contract]
pub struct EducationFundingContract;

#[contractimpl]
impl EducationFundingContract {
    pub fn initialize(env: Env, admin: Address, sponsor: Address, asset: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized")
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Sponsor, &sponsor);
        env.storage().instance().set(&DataKey::Asset, &asset);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn allocate(
        env: Env,
        beneficiary_ref: String,
        institution: Address,
        amount: i128,
        period_ref: String,
    ) {
        Self::require_admin(&env);
        if amount <= 0 {
            panic!("invalid amount")
        }
        let key = DataKey::Allocation(beneficiary_ref.clone());
        if env.storage().persistent().has(&key) {
            panic!("allocation exists")
        }
        let allocation = Allocation {
            beneficiary_ref,
            institution,
            amount,
            period_ref,
            active: true,
            released: false,
        };
        env.storage().persistent().set(&key, &allocation);
    }

    pub fn suspend(env: Env, beneficiary_ref: String) {
        Self::require_admin(&env);
        let key = DataKey::Allocation(beneficiary_ref);
        let mut a: Allocation = env
            .storage()
            .persistent()
            .get(&key)
            .expect("allocation missing");
        a.active = false;
        env.storage().persistent().set(&key, &a);
    }

    pub fn get_allocation(env: Env, beneficiary_ref: String) -> Allocation {
        env.storage()
            .persistent()
            .get(&DataKey::Allocation(beneficiary_ref))
            .expect("allocation missing")
    }

    pub fn authorize_release(env: Env, beneficiary_ref: String) -> Allocation {
        let sponsor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Sponsor)
            .expect("not initialized");
        sponsor.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("contract paused")
        }
        let key = DataKey::Allocation(beneficiary_ref);
        let mut a: Allocation = env
            .storage()
            .persistent()
            .get(&key)
            .expect("allocation missing");
        if !a.active || a.released {
            panic!("not releasable")
        }
        a.released = true;
        env.storage().persistent().set(&key, &a);
        a
    }

    pub fn pause(env: Env, paused: bool) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let sponsor = Address::generate(&env);
        let asset = Address::generate(&env);
        let institution = Address::generate(&env);
        let contract_id = env.register(EducationFundingContract, ());
        let client = EducationFundingContractClient::new(&env, &contract_id);
        client.initialize(&admin, &sponsor, &asset);
        (env, contract_id, institution)
    }

    #[test]
    fn allocates_and_authorizes_once() {
        let (env, contract_id, institution) = setup();
        let client = EducationFundingContractClient::new(&env, &contract_id);
        let beneficiary = String::from_str(&env, "BEN-001");
        let period = String::from_str(&env, "2026-T2");

        client.allocate(&beneficiary, &institution, &500_000, &period);
        let stored = client.get_allocation(&beneficiary);
        assert_eq!(stored.amount, 500_000);
        assert_eq!(stored.institution, institution);
        assert!(stored.active);
        assert!(!stored.released);

        let released = client.authorize_release(&beneficiary);
        assert!(released.released);
    }

    #[test]
    #[should_panic(expected = "not releasable")]
    fn prevents_duplicate_release() {
        let (env, contract_id, institution) = setup();
        let client = EducationFundingContractClient::new(&env, &contract_id);
        let beneficiary = String::from_str(&env, "BEN-002");
        let period = String::from_str(&env, "2026-T2");
        client.allocate(&beneficiary, &institution, &500_000, &period);
        client.authorize_release(&beneficiary);
        client.authorize_release(&beneficiary);
    }

    #[test]
    #[should_panic(expected = "not releasable")]
    fn suspended_allocation_cannot_release() {
        let (env, contract_id, institution) = setup();
        let client = EducationFundingContractClient::new(&env, &contract_id);
        let beneficiary = String::from_str(&env, "BEN-003");
        let period = String::from_str(&env, "2026-T2");
        client.allocate(&beneficiary, &institution, &500_000, &period);
        client.suspend(&beneficiary);
        client.authorize_release(&beneficiary);
    }
}
