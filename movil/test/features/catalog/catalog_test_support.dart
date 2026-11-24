String campaignId(int n) =>
    'a0000000-0000-4000-8000-${n.toString().padLeft(12, '0')}';
const categoryId = 'c0000000-0000-4000-8000-000000000001';

Map<String, Object?> campaignFixture({int number = 1}) => {
  'id': campaignId(number),
  'title': 'Campaña $number',
  'description': 'Descripción completa del proyecto.',
  'shortDescription': 'Resumen del proyecto',
  'goalAmount': 1000,
  'currentAmount': 250,
  'currency': 'BOB',
  'status': 'published',
  'coverImageUrl': null,
  'categoryName': 'Tecnología',
  'entrepreneurName': 'Ana Flores',
  'entrepreneurDisplayName': null,
  'location': 'Santa Cruz',
  'endDate': '2027-03-01T12:00:00Z',
};
Map<String, Object?> categoryFixture() => {
  'id': categoryId,
  'name': 'Tecnología',
  'displayName': 'Tecnología',
};
Map<String, Object?> pageFixture(
  List<Object?> items, {
  int page = 1,
  int pages = 1,
  int? total,
}) => {
  'data': items,
  'meta': {
    'currentPage': page,
    'totalPages': pages,
    'totalItems': total ?? items.length,
    'itemCount': items.length,
    'itemsPerPage': 20,
  },
};
