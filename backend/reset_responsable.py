from getpass import getpass

from app import create_app
from app.extensions import db
from app.models.utilisateur import Utilisateur

app = create_app()

with app.app_context():
    user = db.session.get(Utilisateur, 1)

    if user is None or user.email != "ahmed@garageflow.com":
        print("Erreur : compte Ahmed introuvable.")
    elif user.role != "RESPONSABLE":
        print("Erreur : ce compte n'est pas RESPONSABLE.")
    else:
        password = getpass("Nouveau mot de passe : ")
        confirmation = getpass("Confirmer le mot de passe : ")

        if len(password) < 12:
            print("Erreur : minimum 12 caractères.")
        elif password != confirmation:
            print("Erreur : les mots de passe ne correspondent pas.")
        else:
            user.set_password(password)
            db.session.commit()
            print("Mot de passe réinitialisé avec succès.")
