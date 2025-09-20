import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, query, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Admin credentials
const ADMIN_USERNAME = "DRC27";
const ADMIN_PASSWORD = "DRC27";

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState('');
    const [apps, setApps] = useState([]);
    const [contactMessages, setContactMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // State for Contact Form
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
    const [isSubmittingContact, setIsSubmittingContact] = useState(false);
    const [contactStatus, setContactStatus] = useState(null);

    // State for Admin Panel & Login
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const [newAppForm, setNewAppForm] = useState({ name: '', category: '', description: '', version: '', downloadUrl: '', iconUrl: '', featured: false });
    const [isAddingApp, setIsAddingApp] = useState(false);
    const [addAppStatus, setAddAppStatus] = useState(null);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [appToDelete, setAppToDelete] = useState(null);

    // State for Search and Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Initialise Firebase and authenticate user
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setDb(dbInstance);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(crypto.randomUUID());
                }
                setIsAuthReady(true);
            });

            if (initialAuthToken) {
                signInWithCustomToken(authInstance, initialAuthToken).catch(console.error);
            } else {
                signInAnonymously(authInstance).catch(console.error);
            }

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setLoading(false);
        }
    }, []);

    // Handle URL-based admin access
    useEffect(() => {
        const path = window.location.pathname.split('/');
        // The path should be /admin/username/password
        if (path.length === 4 && path[1] === 'admin') {
            const username = path[2];
            const password = path[3];
            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                setIsLoggedIn(true);
                setShowAdminPanel(true);
            } else {
                // Redirect to homepage if credentials are wrong
                window.history.pushState({}, '', '/');
                setIsLoggedIn(false);
                setShowAdminPanel(false);
            }
        } else {
            setIsLoggedIn(false);
            setShowAdminPanel(false);
        }
    }, []);

    // Fetch public data (apps) from Firestore
    useEffect(() => {
        if (!db || !isAuthReady || !auth || !auth.currentUser) {
            setLoading(false); 
            return;
        }
        setLoading(true);
        const appsPath = `/artifacts/${appId}/public/data/apps`;
        const appsQuery = query(collection(db, appsPath));

        const unsubscribeApps = onSnapshot(appsQuery, (snapshot) => {
            const appsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            appsList.sort((a, b) => a.name.localeCompare(b.name));
            setApps(appsList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching apps:", error);
            setLoading(false);
        });

        return () => {
            unsubscribeApps();
        };
    }, [db, isAuthReady, auth]);

    // Fetch private data (contact messages) from Firestore
    useEffect(() => {
        if (!db || !isAuthReady || !isLoggedIn || !auth || !auth.currentUser) return;
        const messagesPath = `/artifacts/${appId}/users/${userId}/messages`;
        const messagesQuery = query(collection(db, messagesPath));

        const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
            const messagesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            }));
            messagesList.sort((a, b) => b.timestamp - a.timestamp); // Sort descending by date
            setContactMessages(messagesList);
        }, (error) => {
            console.error("Error fetching contact messages:", error);
        });

        return () => {
            unsubscribeMessages();
        };
    }, [db, isAuthReady, isLoggedIn, userId, auth]);


    const handleContactSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingContact(true);
        setContactStatus(null);
        if (!db || !contactForm.name || !contactForm.email || !contactForm.message) {
            setContactStatus({ type: 'error', message: 'Por favor, completa todos los campos.' });
            setIsSubmittingContact(false);
            return;
        }

        try {
            const path = `/artifacts/${appId}/users/${userId}/messages`;
            await addDoc(collection(db, path), {
                ...contactForm,
                timestamp: new Date(),
            });
            setContactStatus({ type: 'success', message: '¡Mensaje enviado con éxito!' });
            setContactForm({ name: '', email: '', message: '' });
        } catch (error) {
            console.error("Error al enviar el mensaje:", error);
            setContactStatus({ type: 'error', message: 'Error al enviar el mensaje. Inténtalo de nuevo.' });
        } finally {
            setIsSubmittingContact(false);
        }
    };

    const handleContactFormChange = (e) => {
        const { name, value } = e.target;
        setContactForm(prev => ({ ...prev, [name]: value }));
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setShowAdminPanel(false);
        // Redirect to homepage
        window.history.pushState({}, '', '/');
    };

    const handleNewAppFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewAppForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAddApp = async (e) => {
        e.preventDefault();
        setIsAddingApp(true);
        setAddAppStatus(null);
        if (!db || !newAppForm.name || !newAppForm.category) {
            setAddAppStatus({ type: 'error', message: 'Nombre y categoría son obligatorios.' });
            setIsAddingApp(false);
            return;
        }

        try {
            const path = `/artifacts/${appId}/public/data/apps`;
            await addDoc(collection(db, path), newAppForm);
            setAddAppStatus({ type: 'success', message: '¡Aplicación añadida con éxito!' });
            setNewAppForm({ name: '', category: '', description: '', version: '', downloadUrl: '', iconUrl: '', featured: false });
        } catch (error) {
            console.error("Error al añadir la aplicación:", error);
            setAddAppStatus({ type: 'error', message: 'Error al añadir la aplicación. Inténtalo de nuevo.' });
        } finally {
            setIsAddingApp(false);
        }
    };

    const confirmDeleteApp = (app) => {
        setAppToDelete(app);
        setShowDeleteConfirmation(true);
    };

    const cancelDelete = () => {
        setAppToDelete(null);
        setShowDeleteConfirmation(false);
    };

    const handleDeleteApp = async () => {
        if (!db || !appToDelete) return;

        try {
            const path = `/artifacts/${appId}/public/data/apps`;
            await deleteDoc(doc(db, path, appToDelete.id));
            setAddAppStatus({ type: 'success', message: '¡Aplicación eliminada con éxito!' });
        } catch (error) {
            console.error("Error al eliminar la aplicación:", error);
            setAddAppStatus({ type: 'error', message: 'Error al eliminar la aplicación.' });
        } finally {
            cancelDelete();
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!db) return;
        try {
            const path = `/artifacts/${appId}/users/${userId}/messages`;
            await deleteDoc(doc(db, path, messageId));
        } catch (error) {
            console.error("Error al eliminar el mensaje:", error);
        }
    };

    // Filter apps based on search query and category
    const filteredApps = apps.filter(app => {
        const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              app.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || app.category.toLowerCase() === selectedCategory.toLowerCase();
        return matchesSearch && matchesCategory;
    });

    const getUniqueCategories = () => {
        const categories = new Set(apps.map(app => app.category));
        return ['all', ...Array.from(categories)];
    };


    return (
        <div className="min-h-screen bg-gray-100 antialiased font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
            `}</style>
            
            {/* Header */}
            <header className="bg-white shadow-sm p-4 sticky top-0 z-50">
                <div className="container mx-auto flex justify-between items-center">
                    <a href="#" className="text-2xl font-bold text-gray-800">Apps Externas</a>
                    <div className="flex items-center space-x-4">
                        <p className="text-sm text-gray-500 hidden md:block">ID de Usuario: {userId}</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto my-8 p-4">

                {/* Admin Panel */}
                {showAdminPanel && (
                    <section className="my-16 p-8 bg-white rounded-xl shadow-lg">
                        <h2 className="text-3xl font-bold text-gray-800 mb-6">Panel de Administración</h2>
                        
                        {/* Admin Tools */}
                        <div className="space-y-12">
                            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-600 transition-colors">
                                Cerrar Sesión
                            </button>
                            
                            {/* Add App Section */}
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold">Añadir Nueva Aplicación</h3>
                                {addAppStatus && (
                                    <div className={`p-4 rounded-lg ${addAppStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {addAppStatus.message}
                                    </div>
                                )}
                                <form onSubmit={handleAddApp} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input type="text" name="name" value={newAppForm.name} onChange={handleNewAppFormChange} placeholder="Nombre de la App" className="p-3 rounded-lg border" required />
                                        <input type="text" name="category" value={newAppForm.category} onChange={handleNewAppFormChange} placeholder="Categoría (Ej: Juegos, Herramientas)" className="p-3 rounded-lg border" required />
                                        <input type="text" name="version" value={newAppForm.version} onChange={handleNewAppFormChange} placeholder="Versión" className="p-3 rounded-lg border" />
                                        <input type="url" name="downloadUrl" value={newAppForm.downloadUrl} onChange={handleNewAppFormChange} placeholder="URL de Descarga" className="p-3 rounded-lg border" />
                                        <input type="url" name="iconUrl" value={newAppForm.iconUrl} onChange={handleNewAppFormChange} placeholder="URL del Icono" className="p-3 rounded-lg border" />
                                        <div className="flex items-center space-x-2">
                                            <input type="checkbox" id="featured" name="featured" checked={newAppForm.featured} onChange={handleNewAppFormChange} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                            <label htmlFor="featured">Destacada</label>
                                        </div>
                                    </div>
                                    <textarea name="description" value={newAppForm.description} onChange={handleNewAppFormChange} placeholder="Descripción (opcional)" rows="3" className="w-full p-3 rounded-lg border"></textarea>
                                    <button type="submit" disabled={isAddingApp} className="w-full bg-blue-600 text-white py-3 rounded-full font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                                        {isAddingApp ? 'Añadiendo...' : 'Añadir Aplicación'}
                                    </button>
                                </form>
                            </div>
                            
                            {/* Contact Messages Section */}
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold">Mensajes de Contacto</h3>
                                {contactMessages.length === 0 ? (
                                    <p className="text-gray-500">No hay mensajes de contacto.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {contactMessages.map(message => (
                                            <div key={message.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="font-semibold">{message.name} - <span className="text-sm text-gray-500">{message.email}</span></p>
                                                    <button onClick={() => handleDeleteMessage(message.id)} className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                                <p className="text-gray-700 mb-2">{message.message}</p>
                                                <p className="text-xs text-gray-400">Recibido: {message.timestamp?.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirmation && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                            <p className="text-lg font-semibold mb-4">¿Estás seguro de que quieres eliminar la aplicación "{appToDelete?.name}"?</p>
                            <div className="flex justify-center space-x-4">
                                <button onClick={handleDeleteApp} className="bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600">Sí, eliminar</button>
                                <button onClick={cancelDelete} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-full hover:bg-gray-400">Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hero Section */}
                <section className="text-center my-16">
                    <h1 className="text-5xl font-extrabold text-gray-900 mb-4">Descubre y Descarga tus Apps Favoritas</h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                        Aquí encontrarás una colección de aplicaciones externas para mejorar tu experiencia digital. 
                        Descarga de forma segura y sencilla.
                    </p>
                    <a href="#apps" className="bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                        Explorar Apps
                    </a>
                </section>
                
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {getUniqueCategories().map(cat => (
                            <option key={cat} value={cat}>
                                {cat === 'all' ? 'Todas las Categorías' : cat}
                            </option>
                        ))}
                    </select>
                </div>


                {/* Dynamic App Sections */}
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    </div>
                ) : (
                    <>
                        <section id="apps" className="my-16">
                            <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">
                                {selectedCategory === 'all' ? 'Todas las Aplicaciones' : selectedCategory}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {filteredApps.length === 0 ? (
                                    <div className="text-center text-gray-500 col-span-full">No se encontraron aplicaciones que coincidan con la búsqueda.</div>
                                ) : (
                                    filteredApps.map(app => (
                                        <div key={app.id} className="relative bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
                                            <div className="flex items-center mb-4">
                                                <img src={app.iconUrl || `https://placehold.co/64x64/2563eb/ffffff?text=${app.name}`} onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/64x64/2563eb/ffffff?text=${app.name}` }} alt={`${app.name} Icon`} className="rounded-lg mr-4" />
                                                <div>
                                                    <h3 className="text-xl font-bold">{app.name}</h3>
                                                    <p className="text-gray-500">Categoría: {app.category}</p>
                                                </div>
                                            </div>
                                            <p className="text-gray-600 mb-4">{app.description}</p>
                                            <a href={app.downloadUrl} className="block text-center bg-green-500 text-white py-2 rounded-full font-semibold hover:bg-green-600 transition-colors">
                                                Descargar
                                            </a>
                                            {showAdminPanel && isLoggedIn && (
                                                <button onClick={() => confirmDeleteApp(app)} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </>
                )}

                {/* Contact Section */}
                <section id="contact" className="my-16 text-center">
                    <h2 className="text-4xl font-bold text-gray-800 mb-8">Contacto</h2>
                    <p className="text-gray-600 mb-4">
                        Si tienes alguna pregunta o sugerencia, no dudes en contactarnos.
                    </p>
                    <form onSubmit={handleContactSubmit} className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg">
                        {contactStatus && (
                            <div className={`p-4 rounded-lg mb-4 ${contactStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {contactStatus.message}
                            </div>
                        )}
                        <div className="mb-4">
                            <input type="text" name="name" value={contactForm.name} onChange={handleContactFormChange} placeholder="Tu Nombre" className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="mb-4">
                            <input type="email" name="email" value={contactForm.email} onChange={handleContactFormChange} placeholder="Tu Email" className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="mb-4">
                            <textarea name="message" value={contactForm.message} onChange={handleContactFormChange} placeholder="Tu Mensaje" rows="4" className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" required></textarea>
                        </div>
                        <button type="submit" disabled={isSubmittingContact} className="w-full bg-blue-600 text-white py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-300">
                            {isSubmittingContact ? 'Enviando...' : 'Enviar Mensaje'}
                        </button>
                    </form>
                </section>

            </main>

            {/* Footer */}
            <footer className="bg-gray-800 text-white p-8 text-center mt-12">
                <p>&copy; 2024 Descargas de Apps Externas. Todos los derechos reservados.</p>
            </footer>
        </div>
    );
};

export default App;
