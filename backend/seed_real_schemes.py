import os
import sys
import uuid
import time
from dotenv import load_dotenv

# Load env variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not url or not key:
    print("Supabase credentials missing in .env")
    sys.exit(1)

sb = create_client(url, key)

REAL_SCHEMES = [
    {
        "id": "a0000000-0000-0000-0000-000000000001",
        "name": "National Means-cum-Merit Scholarship (NMMSS)",
        "category": "Education",
        "jurisdiction": "Central",
        "benefit": "₹12,000 / year (₹1,000/month)",
        "description": "Centrally sponsored scholarship scheme to award 1 lakh meritorious students of economically weaker sections to arrest drop-out at class 8 and encourage them to continue secondary education through class 12.",
        "official_source": "https://scholarships.gov.in (National Scholarship Portal / Ministry of Education)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Class of Study", "requirement": "Studying in Class IX after qualifying NMMSS test in Class VIII", "rule_type": "text", "evidence_source": "School Bonafide / Marksheet"},
            {"criterion_name": "Annual Family Income", "requirement": "Family income not exceeding ₹3,50,000 per annum from all sources", "rule_type": "numeric", "evidence_source": "Income Certificate"},
            {"criterion_name": "School Type", "requirement": "Regular student in Government, Government-aided, or Local Body school", "rule_type": "text", "evidence_source": "School Identity Card"},
            {"criterion_name": "Minimum Marks", "requirement": "At least 55% marks or equivalent grade in Class VII (50% for SC/ST)", "rule_type": "numeric", "evidence_source": "Class VII Marksheet"}
        ],
        "documents": ["Aadhaar Card", "Income Certificate", "Class VII Marksheet", "Bank Passbook", "School Bonafide Certificate"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000002",
        "name": "PM-KISAN Samman Nidhi",
        "category": "Agriculture",
        "jurisdiction": "Central",
        "benefit": "₹6,000 / year in 3 installments of ₹2,000 each",
        "description": "Central sector direct income support scheme for all landholding farmer families across India to supplement their financial needs for procuring agricultural inputs and domestic needs.",
        "official_source": "https://pmkisan.gov.in (Ministry of Agriculture and Farmers Welfare)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Occupation", "requirement": "Landholding farmer with cultivable land parcel registered in land records", "rule_type": "text", "evidence_source": "Land Ownership Records (Khasra/Khatauni/7/12)"},
            {"criterion_name": "Exclusion Check", "requirement": "Not an institutional landholder, constitutional post holder, or income tax payer in previous assessment year", "rule_type": "text", "evidence_source": "Citizen Self-Declaration / PAN Check"},
            {"criterion_name": "Bank Seeding", "requirement": "Active Bank Account linked and seeded with Aadhaar and NPCI DBT", "rule_type": "text", "evidence_source": "Bank Passbook / NPCI Status"}
        ],
        "documents": ["Aadhaar Card", "Land Ownership Record (Khatauni/Khasra/Patta)", "Bank Passbook", "Active Mobile Number"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000003",
        "name": "PM Awas Yojana - Urban (PMAY-U 2.0)",
        "category": "Housing",
        "jurisdiction": "Central",
        "benefit": "Up to ₹2.67 Lakh interest subsidy & financial grant",
        "description": "Credit Linked Subsidy and Beneficiary-Led Construction scheme to provide all-weather pucca houses with basic amenities to eligible urban families belonging to EWS, LIG, and Middle Income Groups.",
        "official_source": "https://pmay-urban.gov.in (Ministry of Housing and Urban Affairs)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Pucca House Ownership", "requirement": "Beneficiary family should not own a pucca house in their name or any family member's name anywhere in India", "rule_type": "text", "evidence_source": "Self-Declaration Affidavit"},
            {"criterion_name": "Annual Household Income", "requirement": "EWS: Up to ₹3 Lakh; LIG: ₹3 Lakh to ₹6 Lakh; MIG: Up to ₹9 Lakh", "rule_type": "numeric", "evidence_source": "Income Certificate / ITR"},
            {"criterion_name": "Female Ownership", "requirement": "House must be registered in the name of the female head of the household or in joint name", "rule_type": "text", "evidence_source": "Identity Document of Female Head"}
        ],
        "documents": ["Aadhaar Card", "Income Certificate / Salary Slip", "Bank Passbook (last 6 months)", "Affidavit of No Pucca House", "Property/Land Document (if BLC component)"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000004",
        "name": "Atal Pension Yojana (APY)",
        "category": "Employment & Pension",
        "jurisdiction": "Central",
        "benefit": "Guaranteed monthly pension of ₹1,000 to ₹5,000 after age 60",
        "description": "Government-backed pension scheme aimed at creating a universal social security system for all Indians, especially workers in the unorganized sector, with guaranteed returns from PFRDA.",
        "official_source": "https://www.npscra.nsdl.co.in (PFRDA / Ministry of Finance)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Age", "requirement": "Between 18 and 40 years at the time of enrollment", "rule_type": "numeric", "evidence_source": "Aadhaar / Birth Proof"},
            {"criterion_name": "Income Tax Status", "requirement": "Citizen should not be an income tax payer as per APY guidelines", "rule_type": "text", "evidence_source": "PAN / Self-Declaration"},
            {"criterion_name": "Savings Account", "requirement": "Must have an active savings bank account or Post Office savings account with auto-debit facility", "rule_type": "text", "evidence_source": "Bank Passbook"}
        ],
        "documents": ["Aadhaar Card", "Bank Passbook / Account Details", "Mobile Number linked to Bank"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000005",
        "name": "Sukanya Samriddhi Yojana (SSY)",
        "category": "Women & Child",
        "jurisdiction": "Central",
        "benefit": "8.2% Compounded Annual Return + Triple Tax Exemption (EEE)",
        "description": "High-interest government small savings scheme under Beti Bachao Beti Padhao initiative to build a dedicated education and marriage fund for girl children.",
        "official_source": "https://www.indiapost.gov.in (Department of Posts / RBI)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Girl Child Age", "requirement": "Age of the girl child must be below 10 years at the time of account opening", "rule_type": "numeric", "evidence_source": "Birth Certificate of Girl Child"},
            {"criterion_name": "Account Limit", "requirement": "Maximum of 2 accounts per family (one for each girl child, up to 3 in case of twin girls)", "rule_type": "text", "evidence_source": "Family Declaration"},
            {"criterion_name": "Citizenship & Residence", "requirement": "Resident Indian citizen until maturity/marriage", "rule_type": "text", "evidence_source": "Guardian Aadhaar"}
        ],
        "documents": ["Birth Certificate of Girl Child", "Guardian Aadhaar Card", "Guardian PAN Card", "Proof of Address", "Photographs"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000006",
        "name": "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)",
        "category": "Healthcare",
        "jurisdiction": "Central",
        "benefit": "₹5,00,000 / year cashless hospitalisation cover per family",
        "description": "World's largest government-funded health assurance scheme providing secondary and tertiary care hospitalization coverage across 27,000+ empanelled public and private hospitals.",
        "official_source": "https://nha.gov.in / https://beneficiary.nha.gov.in (National Health Authority)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Socio-Economic Inclusion", "requirement": "Listed in SECC 2011 database or eligible under NFSA / State Food Security ration categories / Senior Citizens 70+ years", "rule_type": "text", "evidence_source": "Ration Card / PMJAY ID / Aadhaar"},
            {"criterion_name": "Family Cap", "requirement": "No restriction on family size, age, or gender (all family members covered)", "rule_type": "text", "evidence_source": "Family Composite ID / Ration Card"},
            {"criterion_name": "Pre-existing Conditions", "requirement": "All pre-existing medical conditions covered from day one of enrollment", "rule_type": "text", "evidence_source": "Doctor / Hospital Diagnosis"}
        ],
        "documents": ["Aadhaar Card", "Ration Card / NFSA Card", "Active Mobile Number", "Ayushman Card (e-KYC verified)"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000007",
        "name": "PM Vishwakarma Yojana",
        "category": "Skill & Employment",
        "jurisdiction": "Central",
        "benefit": "₹3,00,000 Collateral-free loan at 5% interest + ₹15,000 toolkit grant + Daily ₹500 stipend",
        "description": "Comprehensive central scheme providing end-to-end support to traditional artisans and craftspeople across 18 trades, including skill training, modern toolkit incentive, credit support, and digital transaction incentives.",
        "official_source": "https://pmvishwakarma.gov.in (Ministry of MSME & Ministry of Skill Development)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Traditional Trade", "requirement": "Engaged in one of 18 designated family-based traditional trades (Carpenter, Blacksmith, Potter, Tailor, Sculptor, Cobbler, Mason, Weaver, etc.)", "rule_type": "text", "evidence_source": "Artisan Self-Declaration / Trade Verification"},
            {"criterion_name": "Minimum Age", "requirement": "18 years of age on date of registration", "rule_type": "numeric", "evidence_source": "Aadhaar Card"},
            {"criterion_name": "Family Participation", "requirement": "Only one member of the family is eligible for benefits under the scheme", "rule_type": "text", "evidence_source": "Ration Card / Family Declaration"}
        ],
        "documents": ["Aadhaar Card", "Mobile Number linked with Aadhaar", "Bank Passbook", "Ration Card", "Skill / Trade Verification Certificate"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000008",
        "name": "PM Surya Ghar: Muft Bijli Yojana",
        "category": "Housing",
        "jurisdiction": "Central",
        "benefit": "Up to ₹78,000 direct subsidy + Up to 300 units free monthly electricity",
        "description": "National rooftop solar initiative providing financial subsidy directly into the bank accounts of residential households to install grid-connected solar power systems on their rooftops.",
        "official_source": "https://pmsuryaghar.gov.in (Ministry of New and Renewable Energy)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Residential Rooftop", "requirement": "Applicant must own a residential house with suitable unshaded rooftop space", "rule_type": "text", "evidence_source": "Electricity Bill / Property Document"},
            {"criterion_name": "Grid Connection", "requirement": "Valid and active domestic electricity connection with local DISCOM", "rule_type": "text", "evidence_source": "Latest Electricity Bill"},
            {"criterion_name": "DISCOM Sanction", "requirement": "Net metering approval and technical feasibility from local electricity board", "rule_type": "text", "evidence_source": "DISCOM Approval Letter"}
        ],
        "documents": ["Latest Electricity Bill (showing Consumer Number)", "Aadhaar Card of Electricity Connection Holder", "Bank Account Passbook / Cancelled Cheque", "Rooftop Photo / Ownership Proof"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000009",
        "name": "Pradhan Mantri Mudra Yojana (PMMY)",
        "category": "Business & Loans",
        "jurisdiction": "Central",
        "benefit": "Collateral-free business loan up to ₹20,00,000 (Shishu, Kishore, Tarun & Tarun Plus)",
        "description": "Flagship scheme facilitating micro-credit to non-corporate, non-farm small and micro enterprises for income-generating activities in manufacturing, trading, and services sectors.",
        "official_source": "https://www.mudra.org.in (Department of Financial Services / SIDBI)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Business Entity", "requirement": "Non-farm micro or small business enterprise involved in manufacturing, processing, trading, or services", "rule_type": "text", "evidence_source": "Udyam / Shop Establishment License"},
            {"criterion_name": "Credit History", "requirement": "No previous loan default with any commercial bank, NBFC, or financial institution", "rule_type": "text", "evidence_source": "CIBIL / Bank Statement"},
            {"criterion_name": "Age", "requirement": "Applicant must be at least 18 years of age", "rule_type": "numeric", "evidence_source": "Aadhaar / PAN Card"}
        ],
        "documents": ["Aadhaar Card", "PAN Card", "Business Address Proof / Udyam Registration", "Bank Account Statements (last 6 months)", "Project Report / Quotation for Machinery"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000010",
        "name": "PM SVANidhi (Street Vendor's AtmaNirbhar Nidhi)",
        "category": "Business & Loans",
        "jurisdiction": "Central",
        "benefit": "Working capital micro-loans of ₹10,000 (1st tranche), ₹20,000 (2nd tranche), ₹50,000 (3rd tranche) with 7% interest subsidy",
        "description": "Special micro-credit facility for urban street vendors and hawkers to resume their livelihoods with affordable collateral-free working capital and cashback on digital transactions.",
        "official_source": "https://pmsvanidhi.mohua.gov.in (Ministry of Housing and Urban Affairs)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Vending Verification", "requirement": "Street vendor possessing Certificate of Vending / ID Card issued by Urban Local Body (ULB) or Letter of Recommendation (LoR)", "rule_type": "text", "evidence_source": "Vendor ID Card / ULB Vending Certificate"},
            {"criterion_name": "Location", "requirement": "Operating in urban or peri-urban areas", "rule_type": "text", "evidence_source": "ULB Survey Record / LoR"},
            {"criterion_name": "Bank Seeding", "requirement": "Aadhaar-linked bank account with digital payment capability (UPI/QR)", "rule_type": "text", "evidence_source": "Bank Passbook"}
        ],
        "documents": ["Aadhaar Card", "Vending Certificate / Urban Local Body Survey Card", "Bank Passbook", "Active Mobile Number"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000011",
        "name": "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
        "category": "Women & Child",
        "jurisdiction": "Central",
        "benefit": "₹5,000 cash incentive in bank account for first child, ₹6,000 for second girl child",
        "description": "Direct Benefit Transfer maternity benefit scheme providing partial compensation for wage loss and promoting health-seeking behavior, institutional delivery, and immunization.",
        "official_source": "https://pmmvy.wcd.gov.in (Ministry of Women and Child Development)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Pregnancy Registration", "requirement": "Pregnant Women and Lactating Mothers (PW&LM) registered at Anganwadi Centre / MCP Card", "rule_type": "text", "evidence_source": "Mother and Child Protection (MCP) Card"},
            {"criterion_name": "Exclusion", "requirement": "Not in regular employment with Central/State Government, PSUs or receiving similar maternity benefits under law", "rule_type": "text", "evidence_source": "Citizen Self-Declaration"},
            {"criterion_name": "Income Ceiling", "requirement": "Belongs to economically weaker section, E-shram card holder, BPL, or annual family income within permissible limits", "rule_type": "numeric", "evidence_source": "Ration Card / E-Shram Card / Income Proof"}
        ],
        "documents": ["Aadhaar Card of Mother and Husband", "Mother & Child Protection (MCP) Card", "Bank Passbook of Mother", "Child Birth Certificate (for subsequent installments)"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000012",
        "name": "Post-Matric Scholarship for SC/ST/OBC Students",
        "category": "Education",
        "jurisdiction": "Central",
        "benefit": "100% Tuition fee waiver + Up to ₹13,500 / year maintenance allowance",
        "description": "Centrally sponsored scholarship to provide financial assistance to Scheduled Caste, Scheduled Tribe, and Other Backward Class students studying at post-matriculation or post-secondary stage.",
        "official_source": "https://scholarships.gov.in (Ministry of Social Justice and Empowerment)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Caste Category", "requirement": "Student must belong to Scheduled Caste (SC), Scheduled Tribe (ST), or eligible OBC category", "rule_type": "text", "evidence_source": "Government Caste Certificate"},
            {"criterion_name": "Annual Family Income", "requirement": "Total annual family income must not exceed ₹2,50,000 per annum", "rule_type": "numeric", "evidence_source": "Competent Authority Income Certificate"},
            {"criterion_name": "Course Level", "requirement": "Enrolled in recognized Post-Matriculation course (Class XI, XII, ITI, Diploma, Degree, PG, Ph.D.)", "rule_type": "text", "evidence_source": "College Fee Receipt / Admission Bonafide"}
        ],
        "documents": ["Aadhaar Card", "Caste Certificate", "Income Certificate", "Previous Year Marksheet", "College Admission Slip / Fee Receipt", "Bank Passbook"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000013",
        "name": "Pradhan Mantri Ujjwala Yojana (PMUY 2.0)",
        "category": "Women & Child",
        "jurisdiction": "Central",
        "benefit": "Free LPG gas connection (Cylinder + Regulator + Pipe) + ₹300 per cylinder subsidy",
        "description": "Flagship social welfare scheme to safeguard the health of women and children by providing clean cooking fuel (LPG) to poor households without upfront connection charges.",
        "official_source": "https://www.pmuy.gov.in (Ministry of Petroleum and Natural Gas)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Applicant Gender", "requirement": "Applicant must be an adult woman (aged 18+) belonging to a poor household", "rule_type": "text", "evidence_source": "Aadhaar Card"},
            {"criterion_name": "Existing LPG Connection", "requirement": "No existing LPG connection in the same household from any Oil Marketing Company (IOCL/BPCL/HPCL)", "rule_type": "text", "evidence_source": "OMC De-duplication Check"},
            {"criterion_name": "Household Category", "requirement": "SC/ST, PM Awas Yojana beneficiary, Antyodaya Anna Yojana (AAY), Forest Dwellers, MBC, Tea Garden tribes, or 14-point declaration", "rule_type": "text", "evidence_source": "Ration Card / BPL Certificate"}
        ],
        "documents": ["Aadhaar Card of Woman Applicant", "Ration Card / Family Composition Document", "Bank Passbook", "Proof of Address", "14-Point Declaration Form"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000014",
        "name": "Mahatma Gandhi National Rural Employment Guarantee Act (MGNREGA)",
        "category": "Employment & Pension",
        "jurisdiction": "Central",
        "benefit": "Guaranteed 100 days of wage employment per financial year at statutory wage rates",
        "description": "Legal right to work guaranteeing 100 days of unskilled manual employment to every rural household whose adult members volunteer to do manual labor.",
        "official_source": "https://nrega.nic.in (Ministry of Rural Development)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Residence", "requirement": "Citizen residing in a rural area registered under local Gram Panchayat", "rule_type": "text", "evidence_source": "Voter ID / Ration Card / Gram Panchayat Record"},
            {"criterion_name": "Age", "requirement": "Adult member aged 18 years or above willing to do unskilled manual work", "rule_type": "numeric", "evidence_source": "Aadhaar / Voter ID"},
            {"criterion_name": "Job Card", "requirement": "Possession of active MGNREGA Job Card issued by Gram Panchayat", "rule_type": "text", "evidence_source": "Job Card Copy"}
        ],
        "documents": ["Aadhaar Card", "MGNREGA Job Card", "Bank / Post Office Passbook", "Passport Size Photographs", "Proof of Rural Residence"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000015",
        "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
        "category": "Healthcare",
        "jurisdiction": "Central",
        "benefit": "₹2,00,000 life insurance death coverage for ₹436 annual premium",
        "description": "Affordable government life insurance scheme offering ₹2 Lakh death cover due to any reason to citizens with auto-debit facility from their bank account.",
        "official_source": "https://jansuraksha.gov.in (Department of Financial Services)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Age", "requirement": "Between 18 and 50 years of age at the time of joining", "rule_type": "numeric", "evidence_source": "Aadhaar Card / Birth Certificate"},
            {"criterion_name": "Bank Account", "requirement": "Savings bank account with auto-debit consent enabled", "rule_type": "text", "evidence_source": "Bank Passbook"},
            {"criterion_name": "Premium Debit", "requirement": "Maintenance of minimum balance for ₹436 annual premium deduction in May/June", "rule_type": "numeric", "evidence_source": "Bank Statement"}
        ],
        "documents": ["Aadhaar Card", "Bank Account Details / Passbook", "Nominee Details & KYC"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000016",
        "name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
        "category": "Healthcare",
        "jurisdiction": "Central",
        "benefit": "₹2,00,000 accidental death/total permanent disability cover for ₹20 annual premium",
        "description": "Ultra-affordable accidental insurance scheme providing financial safety against accidental death and permanent disability to Indian citizens.",
        "official_source": "https://jansuraksha.gov.in (Department of Financial Services)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Age", "requirement": "Between 18 and 70 years of age", "rule_type": "numeric", "evidence_source": "Aadhaar Card"},
            {"criterion_name": "Bank Account", "requirement": "Individual bank savings account with auto-debit facility", "rule_type": "text", "evidence_source": "Bank Passbook"}
        ],
        "documents": ["Aadhaar Card", "Bank Passbook", "Nominee KYC Proof"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000017",
        "name": "Rashtriya Vayoshri Yojana",
        "category": "Healthcare",
        "jurisdiction": "Central",
        "benefit": "Free assisted living devices (Wheelchairs, Hearing Aids, Dentures, Spectacles, Walking Sticks)",
        "description": "Central scheme providing physical aids and assisted-living devices for Senior Citizens belonging to BPL category or suffering from age-related disabilities.",
        "official_source": "https://socialjustice.gov.in / ALIMCO (Ministry of Social Justice and Empowerment)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Age", "requirement": "Senior Citizen aged 60 years and above", "rule_type": "numeric", "evidence_source": "Aadhaar / Voter ID Proof"},
            {"criterion_name": "Economic Status", "requirement": "Belongs to Below Poverty Line (BPL) family or monthly income not exceeding ₹15,000", "rule_type": "numeric", "evidence_source": "BPL Ration Card / Income Certificate"},
            {"criterion_name": "Medical Need", "requirement": "Certified age-related disability or impairment in assessment camp", "rule_type": "text", "evidence_source": "Medical Officer Disability Certificate"}
        ],
        "documents": ["Aadhaar Card", "BPL Ration Card / Income Certificate", "Medical Disability Certificate / Assessment Slip", "Passport Size Photograph"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000018",
        "name": "UP Mukhyamantri Kanya Sumangala Yojana",
        "category": "Women & Child",
        "jurisdiction": "State",
        "benefit": "₹25,000 financial assistance across 6 educational & health milestones",
        "description": "Uttar Pradesh state initiative to promote girl child education, eradicate female feticide, and provide conditional cash transfers from birth to graduation.",
        "official_source": "https://mksy.up.gov.in (Women and Child Development Department, UP)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Domicile", "requirement": "Permanent resident of Uttar Pradesh with valid domicile proof", "rule_type": "text", "evidence_source": "UP Domicile / Niwas Praman Patra"},
            {"criterion_name": "Annual Family Income", "requirement": "Family income not exceeding ₹3,00,000 per annum", "rule_type": "numeric", "evidence_source": "Income Certificate"},
            {"criterion_name": "Family Size", "requirement": "Maximum of two daughters per family (except in case of twin girls)", "rule_type": "text", "evidence_source": "Family Declaration Affidavit"}
        ],
        "documents": ["UP Domicile Certificate", "Income Certificate (Max ₹3 Lakh)", "Birth Certificate of Girl Child", "Joint Bank Passbook with Mother", "School Admission Proof"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000019",
        "name": "Mukhyamantri Majhi Ladli Bahin Yojana",
        "category": "Women & Child",
        "jurisdiction": "State",
        "benefit": "₹1,500 / month direct cash assistance into beneficiary bank account",
        "description": "Maharashtra state welfare scheme empowering women by providing financial independence and nutritional security through direct monthly bank transfers.",
        "official_source": "https://ladakibahin.maharashtra.gov.in (Government of Maharashtra)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Domicile & Age", "requirement": "Permanent resident woman of Maharashtra aged between 21 and 65 years", "rule_type": "numeric", "evidence_source": "Maharashtra Domicile / Ration Card & Aadhaar"},
            {"criterion_name": "Family Income", "requirement": "Annual family income not exceeding ₹2,50,000 (exempt if yellow/orange ration card holder)", "rule_type": "numeric", "evidence_source": "Income Certificate / Orange or Yellow Ration Card"},
            {"criterion_name": "Aadhaar DBT Seeding", "requirement": "Individual bank account with active Aadhaar DBT link", "rule_type": "text", "evidence_source": "Bank Passbook with NPCI Active Status"}
        ],
        "documents": ["Aadhaar Card", "Ration Card (Yellow/Orange)", "Maharashtra Domicile Certificate / Birth Certificate", "Bank Passbook", "Self-Declaration of Income"]
    },
    {
        "id": "a0000000-0000-0000-0000-000000000020",
        "name": "PM Vidya Lakshmi Higher Education Scheme",
        "category": "Education",
        "jurisdiction": "Central",
        "benefit": "Collateral-free education loan up to ₹7.5 Lakh with 3% interest subvention",
        "description": "Cabinet-approved initiative to ensure financial constraints never prevent meritorious students from pursuing higher education in top 860 national quality institutions (NIRF ranked).",
        "official_source": "https://www.vidyalakshmi.co.in (Department of Higher Education)",
        "eligibility_status": "Active",
        "rules": [
            {"criterion_name": "Admission Quality", "requirement": "Admitted to recognized higher education course in top 860 designated Higher Education Institutions (HEIs)", "rule_type": "text", "evidence_source": "College Admission Letter & Fee Structure"},
            {"criterion_name": "Family Income", "requirement": "Family income up to ₹8,00,000 per annum for interest subvention support", "rule_type": "numeric", "evidence_source": "Income Certificate / ITR"},
            {"criterion_name": "Merit", "requirement": "Satisfies entrance requirements of the admitting institution", "rule_type": "text", "evidence_source": "Entrance Exam Scorecard / Class XII Marksheet"}
        ],
        "documents": ["Aadhaar Card", "Class 10 & 12 Marksheets", "Institution Admission Letter", "Fee Schedule Breakdown", "Parent Income Certificate / ITR", "Bank Account Statement"]
    }
]

def seed_database():
    print(f"Starting seeding of {len(REAL_SCHEMES)} official government schemes...")
    
    for s in REAL_SCHEMES:
        scheme_id = s["id"]
        scheme_payload = {
            "id": scheme_id,
            "name": s["name"],
            "category": s["category"],
            "jurisdiction": s["jurisdiction"],
            "benefit": s["benefit"],
            "description": s["description"],
            "official_source": s["official_source"],
            "eligibility_status": s["eligibility_status"],
            "last_verified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        
        # Upsert Scheme
        res = sb.table("schemes").upsert(scheme_payload, on_conflict="id").execute()
        print(f"✓ Upserted Scheme: {s['name']}")
        
        # Delete old rules and doc requirements for clean state
        try:
            sb.table("eligibility_rules").delete().eq("scheme_id", scheme_id).execute()
            sb.table("document_requirements").delete().eq("scheme_id", scheme_id).execute()
        except Exception as e:
            print(f"  Notice during cleanup: {e}")
            
        # Insert Eligibility Rules
        rules_payload = [
            {
                "scheme_id": scheme_id,
                "criterion_name": r["criterion_name"],
                "requirement": r["requirement"],
                "rule_type": r.get("rule_type", "text"),
                "evidence_source": r.get("evidence_source", "Identity Document"),
            }
            for r in s.get("rules", [])
        ]
        if rules_payload:
            sb.table("eligibility_rules").insert(rules_payload).execute()
            print(f"  + Added {len(rules_payload)} eligibility rules")
            
        # Insert Document Requirements
        docs_payload = [
            {
                "scheme_id": scheme_id,
                "document_type": d,
                "is_mandatory": True,
            }
            for d in s.get("documents", [])
        ]
        if docs_payload:
            sb.table("document_requirements").insert(docs_payload).execute()
            print(f"  + Added {len(docs_payload)} document requirements")

    print(f"\n🎉 Successfully seeded {len(REAL_SCHEMES)} official schemes into Supabase DB!")

if __name__ == "__main__":
    seed_database()
