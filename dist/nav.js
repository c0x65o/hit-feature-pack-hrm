/**
 * Navigation contributions for HRM feature pack
 */
export const navContributions = [
    {
        id: 'hrm',
        label: 'HRM',
        path: '/hrm/employees',
        icon: 'Users',
        group: 'main',
        weight: 50,
        roles: ['admin'],
        showWhen: 'authenticated',
        children: [
            {
                id: 'hrm-employees',
                label: 'Employees',
                path: '/hrm/employees',
                icon: 'IdCard',
                roles: ['admin'],
                showWhen: 'authenticated',
            },
        ],
    },
];
