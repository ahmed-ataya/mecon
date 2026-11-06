/**
 * The real staff list (50 people) supplied 2026-08-18 as "Employe List.xlsx".
 *
 * Data only, deliberately: this file has NO side effects, so importing it
 * can never run anything. It used to live inside scripts/import-employees.ts,
 * which calls main() at module scope — importing the roster from there would
 * have executed the import against whatever database happened to be
 * connected. Pulled out here so scripts/merge-staff-list.ts can reuse the
 * same list without that hazard.
 *
 * The DESIGNATION -> category mapping involved judgment calls on a few
 * ambiguous titles (CAMP BOSS -> MANAGEMENT, WS OFFICE BOY ->
 * MECHANIC_WORKSHOP) — confirm with the business if any read wrong.
 */
import type { EmployeeCategory } from '../src/lib/enums'

export type Row = { staffNo: string; name: string; designation: string; category: EmployeeCategory }

export const ROWS: Row[] = [
  { staffNo: '5404', name: 'Mohamed Fawzul', designation: 'WS Supervisor', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5459', name: 'Mohammed Shalin', designation: 'Camp Boss', category: 'MANAGEMENT' },
  { staffNo: '5257', name: 'Poovanakanth', designation: 'Transport Driver', category: 'DRIVER' },
  { staffNo: '5419', name: 'Raynard Mohideen', designation: 'Transport Driver', category: 'DRIVER' },
  { staffNo: '5436', name: 'Rajarama Kukkada', designation: 'Head Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '6008', name: 'Thiyagarajan Kandasami', designation: 'Auto Electrician', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5417', name: 'Mohammad Mustakim', designation: 'Auto Electrician', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5069', name: 'Dumindu Lakmal', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5384', name: 'Abdul Karimu Adam', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5385', name: 'Samuel Boamah', designation: 'Mechanic', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5446', name: 'Chulani Nisantha', designation: 'Painter', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5433', name: 'Musyafi Akhwan', designation: 'Welder', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5457', name: 'Primali Sanjeewa', designation: 'Welder', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5424', name: 'Paramjit Lal', designation: 'Tire Man', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '5197', name: 'Kwabena Kundale', designation: 'Wash Man/Helper', category: 'HELPER_LABOURER' },
  { staffNo: '5369', name: 'Mohammad Sofian', designation: 'Accounts', category: 'ADMIN_OFFICE' },
  { staffNo: '5141', name: 'Abdelhadi Yassin', designation: 'PRO', category: 'ADMIN_OFFICE' },
  { staffNo: '5410', name: 'Mohammad Shanu', designation: 'Sales/Ops Manager', category: 'MANAGEMENT' },
  { staffNo: '5412', name: 'Mohamed Asath', designation: 'Office Boy', category: 'ADMIN_OFFICE' },
  { staffNo: '5429', name: 'Moitheen Khan', designation: 'Logistic Coordinator', category: 'ADMIN_OFFICE' },
  { staffNo: '5092', name: 'Kashyapa Indika', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5135', name: 'Ramesh Kandel', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5421', name: 'Abeywardhana', designation: 'Backhoe Loader', category: 'OPERATOR' },
  { staffNo: '5014', name: 'Ajay Shrestha', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5016', name: 'Vim Bahadur Bharati', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5042', name: 'Laxmi Prasad', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '5166', name: 'Ram Ekabal', designation: 'Boom Truck', category: 'OPERATOR' },
  { staffNo: '6015', name: 'Kailash Raut', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5064', name: 'Chandana Samantha', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5357', name: 'Samin Miya', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5422', name: 'Sashintha Dilhan', designation: 'Excavator', category: 'OPERATOR' },
  { staffNo: '5461', name: 'Kiran Limbu', designation: 'Lowbed/Boom Truck', category: 'OPERATOR' },
  { staffNo: '5354', name: 'Sanjoy George', designation: 'Mini Excavator', category: 'OPERATOR' },
  { staffNo: '5426', name: 'Nalin Wasantha', designation: 'Motor Grader', category: 'OPERATOR' },
  { staffNo: '5288', name: 'Tara Majhi', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5312', name: 'Bijaya Tawa', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5316', name: 'Baburam Adhikari', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5318', name: 'Padam Bahadur Poudel', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5320', name: 'Prem Niraula', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5322', name: 'Niraj Pariyar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5400', name: 'Shailendra Kumar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5455', name: 'Ram Kumar Kunwar', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5456', name: 'Sendilnanan', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5458', name: 'Raj Kumar Nembang', designation: 'Skid Loader', category: 'OPERATOR' },
  { staffNo: '5454', name: 'Latif Gul', designation: 'Telehandler', category: 'OPERATOR' },
  { staffNo: '5145', name: 'Basanta Adhikari', designation: 'Telehandler', category: 'OPERATOR' },
  { staffNo: '5463', name: 'Ram Ashish', designation: 'Telehandler/Forklift', category: 'OPERATOR' },
  { staffNo: '5453', name: 'Mohamed Ismath', designation: 'WS Office Boy', category: 'MECHANIC_WORKSHOP' },
  { staffNo: '7001', name: 'Nashan Nasar', designation: 'Helper', category: 'HELPER_LABOURER' },
  { staffNo: '7002', name: 'Mohammed Zoomi', designation: 'Helper', category: 'HELPER_LABOURER' },
]
