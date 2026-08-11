package com.blockvote.android.di

import com.blockvote.android.data.repository.FakeElectionRepository
import com.blockvote.android.domain.repository.ElectionRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindElectionRepository(
        fakeElectionRepository: FakeElectionRepository
    ): ElectionRepository
}
