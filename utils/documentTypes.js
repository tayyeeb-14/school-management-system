const documentTypes = Object.freeze([
  {
    key: 'marksheet',
    label: 'Marksheet',
    description: 'Subject-wise marks report'
  },
  {
    key: 'admit-card',
    label: 'Admit Card',
    description: 'Exam hall ticket and exam details'
  },
  {
    key: 'id-card-front',
    label: 'ID Card',
    description: 'Student identity card'
  },
  {
    key: 'certificate',
    label: 'Certificate',
    description: 'Completion or achievement certificate'
  }
]);

const DOCUMENT_TYPE_MAP = Object.freeze(
  documentTypes.reduce((acc, docType) => {
    acc[docType.key] = docType;
    return acc;
  }, {})
);

module.exports = {
  documentTypes,
  DOCUMENT_TYPES: documentTypes,
  DOCUMENT_TYPE_MAP
};
