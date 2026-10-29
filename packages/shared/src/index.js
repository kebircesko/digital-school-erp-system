/**
 * Shared data shapes for the API and desktop application.
 * These JSDoc types provide editor hints without a compilation step.
 *
 * @typedef {'ADMIN' | 'FINANCE' | 'INSTRUCTOR'} Role
 * @typedef {'ACTIVE' | 'INACTIVE'} StudentStatus
 *
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {Role} role
 *
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} birthDate
 * @property {string} parentName
 * @property {string} parentPhone
 * @property {string | null} address
 * @property {string | null} notes
 * @property {StudentStatus} status
 * @property {number} version
 * @property {string} createdAt
 *
 * @typedef {Object} StudentInput
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} birthDate
 * @property {string} parentName
 * @property {string} parentPhone
 * @property {string} [address]
 * @property {string} [notes]
 * @property {StudentStatus} status
 *
 * @typedef {Object} StudentPage
 * @property {Student[]} items
 * @property {number} total
 * @property {number} page
 * @property {number} pages
 *
 * @typedef {Object} FinancialSummary
 * @property {string} daily
 * @property {string} monthly
 * @property {string} yearly
 * @property {string} outstanding
 * @property {number} paid
 * @property {number} unpaid
 * @property {{month: string, amount: string}[]} chart
 *
 * @typedef {Object} Dashboard
 * @property {number} courses
 * @property {number} groups
 * @property {FinancialSummary} [financial]
 * @property {number} total
 * @property {number} active
 * @property {number} inactive
 * @property {Student[]} recent
 */
module.exports = {};
